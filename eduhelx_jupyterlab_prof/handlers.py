import json
import os
import tempfile
import shutil
import tornado
import asyncio
import httpx
import traceback
import csv
# from numpy import median, mean, std
from io import StringIO
from urllib.parse import urlparse
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from pathlib import Path
from datetime import datetime
from collections.abc import Iterable
from .config import ExtensionConfig
from eduhelx_utils.git import (
    InvalidGitRepositoryException,
    clone_repository, init_repository, fetch_repository,
    get_tail_commit_id, get_repo_name, add_remote,
    stage_files, commit, push, get_commit_info,
    get_modified_paths, checkout, get_repo_root as get_git_repo_root,
    get_head_commit_id, reset as git_reset, merge as git_merge,
    abort_merge, delete_local_branch, is_ancestor_commit,
    stash_changes, pop_stash, diff_status as git_diff_status,
    restore as git_restore, rm as git_rm
)
from eduhelx_utils.api import Api, AuthType
from eduhelx_utils.process import execute
from .instructor_repo import InstructorClassRepo, NotInstructorClassRepositoryException
from ._version import __version__

class AppContext:
    def __init__(self, serverapp):
        self.serverapp = serverapp
        self.config = ExtensionConfig(self.serverapp)
        api_config = dict(
            api_url=self.config.GRADER_API_URL,
            user_onyen=self.config.USER_NAME,
            jwt_refresh_leeway_seconds=self.config.JWT_REFRESH_LEEWAY_SECONDS
        )
        # If autogen password happens to be set (e.g. if running locally), then use it for convenience.
        if self.config.USER_AUTOGEN_PASSWORD != "":
            self.api = Api(
                **api_config,
                user_autogen_password=self.config.USER_AUTOGEN_PASSWORD,
                auth_type=AuthType.PASSWORD
            )
        else:
            self.api = Api(
                **api_config,
                appstore_access_token=self.config.ACCESS_TOKEN,
                auth_type=AuthType.APPSTORE_INSTRUCTOR
            )
        self.api.client.timeout = httpx.Timeout(15.0, read=15.0)

    async def get_repo_root(self):
        course = await self.api.get_course()
        return InstructorClassRepo._compute_repo_root(course["name"])

class BaseHandler(APIHandler):
    context: AppContext = None

    @property
    def config(self) -> ExtensionConfig:
        return self.context.config

    @property
    def api(self) -> Api:
        return self.context.api

class CourseAndInstructorAndStudentsHandler(BaseHandler):
    async def get_value(self):
        instructor = await self.api.get_my_user()
        students = await self.api.list_students()
        course = await self.api.get_course()
        return json.dumps({
            "instructor": instructor,
            "students": students,
            "course": course
        })
    
    @tornado.web.authenticated
    async def get(self):
        self.finish(await self.get_value())

class AssignmentsHandler(BaseHandler):
    async def get_value(self, current_path: str):
        current_path_abs = os.path.realpath(current_path)

        assignments = await self.api.get_my_assignments()
        course = await self.api.get_course()

        value = {
            "current_assignment": None,
            "assignments": None,
        }

        try:
            instructor_repo = InstructorClassRepo(course, assignments, current_path_abs)
        except Exception:
            return json.dumps(value)

        # Add absolute path to assignment so that the frontend
        # extension knows how to open the assignment without having
        # to know the repository root.
        for assignment in assignments:
            # The frontend can only access files under directory where the Jupyter server is running,
            # so we need to make sure the "absolute" path is actually relative to the Jupyter server
            cwd = os.getcwd()
            rel_assignment_path = os.path.relpath(
                instructor_repo.get_assignment_path(assignment),
                cwd
            )
            # The cwd is the root in the frontend, so treat the path as such.
            # NOTE: IMPORTANT: this field is NOT absolute on the server. It's only the absolute path for the webapp.
            assignment["absolute_directory_path"] = os.path.join("/", rel_assignment_path)

            assignment["staged_changes"] = []
            for modified_path in get_modified_paths(path=instructor_repo.repo_root):
                full_modified_path = instructor_repo.repo_root / modified_path["path"]
                abs_assn_path = instructor_repo.repo_root / assignment["directory_path"]
                try:
                    path_relative_to_assn = full_modified_path.relative_to(abs_assn_path)
                    modified_path["path_from_repo"] = modified_path["path"]
                    modified_path["path_from_assn"] = str(path_relative_to_assn)
                    assignment["staged_changes"].append(modified_path)
                except ValueError:
                    # This path is not part of the assignment directory
                    pass

        value["assignments"] = assignments
        
        current_assignment = instructor_repo.current_assignment
        if current_assignment:
            current_assignment["student_submissions"] = await self.api.get_submissions(current_assignment["id"])
            for student in current_assignment["student_submissions"]:
                for i, submission in enumerate(current_assignment["student_submissions"][student]):
                    if i == 0: submission["active"] = True
                    submission["commit"] = {
                        "id": submission["commit_id"],
                        "message": "",
                        "author_name": "",
                        "author_email": "",
                        "committer_name": "",
                        "committer_email": ""
                    }

        value["current_assignment"] = current_assignment
        return json.dumps(value)

    @tornado.web.authenticated
    async def get(self):
        current_path: str = self.get_argument("path")
        self.finish(await self.get_value(current_path))

    @tornado.web.authenticated
    async def patch(self):
        name = self.get_argument("name")
        data = self.get_json_body()

        try:
            await self.api.update_assignment(name, **data)
        except Exception as e:
            self.set_status(e.response.status_code)
            self.finish(e.response.text)

class SubmissionHandler(BaseHandler):
    @tornado.web.authenticated
    async def post(self):
        data = json.loads(self.request.body)
        submission_summary: str = data["summary"]
        current_path: str = data["current_path"]
        current_path_abs = os.path.realpath(current_path)

        instructor = await self.api.get_my_user()
        assignments = await self.api.get_my_assignments()
        course = await self.api.get_course()

        try:
            instructor_repo = InstructorClassRepo(course, assignments, current_path_abs)
        except InvalidGitRepositoryException:
            self.set_status(400)
            self.finish(json.dumps({
                "message": "Not in a git repository"
            }))
            return
        except NotInstructorClassRepositoryException:
            self.set_status(400)
            self.finish(json.dumps({
                "message": "Not in your class repository"
            }))
            return
        
        if instructor_repo.current_assignment is None:
            self.set_status(400)
            self.finish(json.dumps({
                "message": "Not in an assignment directory"
            }))
            return

        current_assignment_path = instructor_repo.get_assignment_path(instructor_repo.current_assignment)

        try:
            instructor_repo = InstructorClassRepo(course, assignments, current_assignment_path)
            instructor_repo.create_student_notebook()
        except Exception as e:
            self.set_status(400)
            self.finish(json.dumps({
                "message": "Failed to generate student version of assignment notebook: " + str(e)
            }))
            return

        rollback_id = get_head_commit_id(path=instructor_repo.repo_root)
        stage_files(".", path=current_assignment_path)

        # Instead of annoying professors by constantly asking them to update their gitignore,
        # we can reset protected files before hitting the pre-receive hook.
        # for file in instructor_repo.get_protected_file_paths(instructor_repo.current_assignment):
        #     git_reset(file, path=current_assignment_path)
            
        
        try:
            commit_id = commit(
                submission_summary,
                None,
                path=current_assignment_path
            )
        except Exception as e:
            # If the commit fails, reset and abort.
            git_reset(".", path=current_assignment_path)
            self.set_status(500)
            self.finish(str(e))
            return
        
        try:
            push(InstructorClassRepo.ORIGIN_REMOTE_NAME, InstructorClassRepo.MAIN_BRANCH_NAME, path=current_assignment_path)
            self.finish()
        except Exception as e:
            # If the push fails, but we've already committed,
            # rollback the commit and abort.
            git_reset(rollback_id, path=instructor_repo.repo_root)

            remote_echos = [line.partition("remote:")[2].strip() for line in str(e).splitlines() if line.strip().startswith("remote:")]
            if len(remote_echos) > 0:
                # Rejected by a Git hook
                self.set_status(409)
                self.finish(json.dumps(remote_echos))
            else:
                self.set_status(500)
                self.finish(str(e))

""" This is used for selecting the graded notebook. """
class NotebookFilesHandler(BaseHandler):
    @tornado.web.authenticated
    async def get(self):
        course = await self.api.get_course()
        assignments = await self.api.get_my_assignments()

        assignment_notebooks = {}
        for assignment in assignments:
            repo_root = InstructorClassRepo._compute_repo_root(course["name"]).resolve()
            assignment_path = repo_root / assignment["directory_path"]

            notebooks = [path.relative_to(assignment_path) for path in assignment_path.rglob("*.ipynb")]
            notebooks = [path for path in notebooks if ".ipynb_checkpoints" not in path.parts and path != Path(assignment["student_notebook_path"])]
            # Sort by nestedness, then alphabetically
            notebooks.sort(key=lambda path: (len(path.parents), str(path)))

            assignment_notebooks[assignment["id"]] = [str(path) for path in notebooks]

        self.finish(json.dumps({
            "notebooks": assignment_notebooks
        }))

class SyncToLMSHandler(BaseHandler):
    @tornado.web.authenticated
    async def post(self):
        await self.api.lms_downsync()
        self.finish()

class GradeAssignmentHandler(BaseHandler):
    # assignment_id -> job id
    GRADING_JOBS = {}

    @tornado.web.authenticated
    async def post(self):
        data = self.get_json_body()
        current_path: str = data["current_path"]
        current_path_abs = os.path.realpath(current_path)

        try:
            course = await self.api.get_course()
            assignments = await self.api.get_my_assignments()
            repo = InstructorClassRepo(course, assignments, current_path_abs)
            if repo.current_assignment is None: raise Exception()
        except Exception:
            self.set_status(400)
            self.finish({
                "message": "current_path is not in an eduhelx assignment"
            })
            return
        
        master_notebook_path = repo.current_assignment["master_notebook_path"]
        try:
            with open(repo.current_assignment_path / master_notebook_path, "r") as f:
                master_notebook_content = f.read()
        except FileNotFoundError:
            self.set_status(404)
            self.finish({
                'message': f'Master notebook "{ master_notebook_path }" does not exist in assignment directory'
            })
        try: 
            with open(repo.current_assignment_path / "otter_grading_config.json", "r") as f:
                otter_config_content = f.read()
        except FileNotFoundError:
            self.set_status(404)
            self.finish({
                'message': 'Grading config "otter_grading_config.json" does not exist in assignment directory'
            })

        await self.api.grade_assignment(repo.current_assignment["name"], master_notebook_content, otter_config_content)


class SettingsHandler(BaseHandler):
    @tornado.web.authenticated
    async def get(self):
        server_version = str(__version__)
        repo_root = await self.context.get_repo_root()

        self.finish(json.dumps({
            "serverVersion": server_version,
            "repoRoot": str(repo_root)
        }))


async def create_repo_root_if_not_exists(context: AppContext) -> None:
    repo_root = await context.get_repo_root()
    if not repo_root.exists():
        repo_root.mkdir(parents=True)

async def create_ssh_config_if_not_exists(context: AppContext, course) -> None:
    course = await context.api.get_course()
    settings = await context.api.get_settings()
    repo_root = InstructorClassRepo._compute_repo_root(course["name"]).resolve()
    ssh_config_dir = repo_root / ".ssh"
    ssh_config_file = ssh_config_dir / "config"
    ssh_identity_file = ssh_config_dir / "id_gitea"
    ssh_public_key_file = ssh_config_dir / "id_gitea.pub"

    ssh_public_url = course["master_remote_url"]
    if not urlparse(ssh_public_url).scheme:
        ssh_public_url = "ssh://" + ssh_public_url

    ssh_private_url = settings["gitea_ssh_url"] if not context.config.LOCAL else "ssh://git@localhost:2222"
    if not urlparse(ssh_private_url).scheme:
        ssh_private_url = "ssh://" + ssh_private_url 

    ssh_public_url_parsed = urlparse(ssh_public_url)
    ssh_private_url_parsed = urlparse(ssh_private_url)

    ssh_public_hostname = ssh_public_url_parsed.hostname
    ssh_private_hostname = ssh_private_url_parsed.hostname
    ssh_port = ssh_private_url_parsed.port or 2222
    ssh_user = ssh_private_url_parsed.username or "git"
    
    if not ssh_identity_file.exists():
        ssh_config_dir.mkdir(parents=True, exist_ok=True)
        execute(["ssh-keygen", "-t", "rsa", "-f", ssh_identity_file, "-N", ""])
    with open(ssh_config_file, "w+") as f:
        # Host (public Gitea URL) is rewritten as an alias to HostName (private ssh URL)
        f.write( 
            # Note that Host is really a hostname in SSH config. and is an alias to HostName here.
            f"Host { ssh_public_hostname }\n" \
            f"   User { ssh_user }\n" \
            f"   Port { ssh_port }\n" \
            f"   IdentityFile { ssh_identity_file }\n" \
            f"   HostName { ssh_private_hostname }\n" \
            f"   StrictHostKeyChecking no\n" \
            f"   UserKnownHostsFile /dev/null\n"
        )
    with open(ssh_public_key_file, "r") as f:
        public_key = f.read()
        await context.api.set_ssh_key("jlp-client", public_key)

async def clone_repo_if_not_exists(context: AppContext, course) -> None:
    repo_root = InstructorClassRepo._compute_repo_root(course["name"])
    try:
        get_git_repo_root(path=repo_root)
    except InvalidGitRepositoryException:
        """ This could just be an outright clone, but to stay consistent with how JLS fetches,
        we will also fetch here.
        """
        master_repository_url = course["master_remote_url"]
        init_repository(repo_root)
        await set_git_authentication(context)
        add_remote(InstructorClassRepo.ORIGIN_REMOTE_NAME, master_repository_url, path=repo_root)
        fetch_repository(InstructorClassRepo.ORIGIN_REMOTE_NAME, path=repo_root)
        checkout(f"{ InstructorClassRepo.MAIN_BRANCH_NAME }", path=repo_root)
        
        

async def set_git_authentication(context: AppContext, course, instructor) -> None:
    repo_root = InstructorClassRepo._compute_repo_root(course["name"]).resolve()
    master_repository_url = course["master_remote_url"]
    ssh_config_file = repo_root / ".ssh" / "config"
    ssh_identity_file = repo_root / ".ssh" / "id_gitea"

    parsed_remote = urlparse(master_repository_url)
    protocol, host = parsed_remote.scheme, parsed_remote.netloc
    use_password_auth = protocol == "http" or protocol == "https"

    try:
        get_git_repo_root(path=repo_root)
        execute(["git", "config", "--local", "--unset-all", "credential.helper"], cwd=repo_root)
        execute(["git", "config", "--local", "--unset-all", "core.sshCommand"], cwd=repo_root)

        execute(["git", "config", "--local", "user.name", context.config.USER_NAME], cwd=repo_root)
        execute(["git", "config", "--local", "user.email", instructor["email"]], cwd=repo_root)
        execute(["git", "config", "--local", "author.name", context.config.USER_NAME], cwd=repo_root)
        execute(["git", "config", "--local", "author.email", instructor["email"]], cwd=repo_root)
        execute(["git", "config", "--local", "committer.name", context.config.USER_NAME], cwd=repo_root)
        execute(["git", "config", "--local", "committer.email", instructor["email"]], cwd=repo_root)

        if use_password_auth:
            execute(["git", "config", "--local", "credential.helper", ""], cwd=repo_root)
            execute(["git", "config", "--local", "--add", "credential.helper", context.config.CREDENTIAL_HELPER], cwd=repo_root)
        else:
            execute(["git", "config", "--local", "core.sshCommand", f'ssh -F { ssh_config_file } -i { ssh_identity_file }'], cwd=repo_root)
    except InvalidGitRepositoryException:
        config_path = repo_root / ".git" / "config"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w+") as f:
            ssh_credential_config = (
                "[core]\n"
                f'    sshCommand = ssh -F { ssh_config_file } -i { ssh_identity_file }\n'
            )
            password_credential_config = (
                f"[credential]\n"
                f"    helper = ''\n"
                f"    helper = { context.config.CREDENTIAL_HELPER }\n"
            )
            credential_config = (
                f"{ ssh_credential_config }"
                "[user]\n"
                f"    name = { context.config.USER_NAME }\n"
                f"    email = { instructor['email'] }\n"
                "[author]\n"
                f"    name = { context.config.USER_NAME }\n"
                f"    email = { instructor['email'] }\n"
                "[committer]\n"
                f"    name = { context.config.USER_NAME }\n"
                f"    email = { instructor['email'] }\n"
                f"{ password_credential_config }" if use_password_auth else ""
            )
            f.write(credential_config)
    
    if use_password_auth:
        credentials = \
            f"protocol={ protocol }\n" \
            f"host={ host }\n" \
            f"username={ context.config.USER_NAME }\n" \
            f"password={ context.config.USER_AUTOGEN_PASSWORD }"
        execute(["git", "credential", "approve"], stdin_input=credentials, cwd=repo_root)
            
async def set_root_folder_permissions(context: AppContext) -> None:
    # repo_root = await context.get_repo_root()
    # execute(["chown", "root", repo_root.parent])
    # execute(["chmod", "+t", repo_root.parent])
    # execute(["chmod", "a-w", repo_root.parent])
    ...

async def sync_upstream_repository(context: AppContext, course) -> None:

    def gather_overwritable_paths():
        nonlocal overwritable_paths
        for assignment in assignments:
            for glob_pattern in assignment["overwritable_files"]:
                overwritable_paths.update((repo_root / assignment["directory_path"]).glob(glob_pattern))

    def rename_merge_conflicts(merge_conflicts):
        conflict_types = {
            conflict["path"] : conflict["modification_type"] for conflict in get_modified_paths(path=repo_root)
            if conflict["path"] in merge_conflicts
        }
        for conflict in merge_conflicts:
            if repo_root / conflict not in overwritable_paths:
                # If the file isn't overwritable, make a backup of it (as long as it's not deleted locally).
                print("Encountered non-overwriteable merge conflict", conflict, ". Creating backup...")
                backup_file(conflict)
            else:
                print(f"Detected overwritable merge conflict: '{ conflict }'")
            
            # Overwrite the file with its incoming version -- resolve the conflict.
            if conflict_types[conflict][1] != "D":
                git_restore(conflict, source="MERGE_HEAD", staged=True, worktree=True, path=repo_root)
            else:
                # If the conflict was deleted on the merge head, git restore won't be able to restore it.
                # Instead, just update the index/worktree to also delete the file.
                git_rm(conflict, cached=False, path=repo_root)

    def backup_file(conflict_path: Path):
        nonlocal file_contents
        print("BACKING UP FILE", conflict_path)
        full_conflict_path = repo_root / conflict_path
        if full_conflict_path in file_contents:
            # Backup the student's changes to a new file.
            backup_path = repo_root / Path(f"{ conflict_path }~{ isonow }~backup")
            with open(backup_path, "wb+") as f:
                f.write(file_contents[full_conflict_path])
        else:
            print(str(conflict_path), "deleted locally, cannot create a backup.")

    def move_untracked_files():
        nonlocal untracked_files, repo_root
        for file in untracked_files:
            untracked_path = untracked_files_dir / file
            untracked_path.parent.mkdir(parents=True, exist_ok=True)
            (repo_root / file).rename(untracked_path)
    
    def restore_untracked_files():
        # Git refuses to allow you to apply a stash if any untracked changes within the stash exist locally.
        # Thus, we have to manually move and then backup untracked files after merging.
        for original_file in untracked_files:
            full_original_file_path = repo_root / original_file
            untracked_path = untracked_files_dir / original_file

            if not full_original_file_path.exists():
                # If the file doesn't exist post-merge, it hasn't been changed at all, and we can just
                # move the file back to its original path in the repo.
                untracked_path.rename(full_original_file_path)
            elif full_original_file_path.read_bytes() != untracked_path.read_bytes():
                # If the file exists post merge, but its content is the exact same, we woudn't need to take any actions.
                # The file exists but its content has changed, so backup the old version.
                print(f"Couldn't restore untracked file '{ original_file }' as it already exists on HEAD, backing up instead...")
                backup_file(original_file)

    assignments = await context.api.get_my_assignments()
    repo_root = InstructorClassRepo._compute_repo_root(course["name"])

    try:
        fetch_repository(InstructorClassRepo.ORIGIN_REMOTE_NAME, path=repo_root)
    except:
        print("Fatal: Couldn't fetch remote tracking branch, aborting sync...")
        return
    
    checkout(InstructorClassRepo.MAIN_BRANCH_NAME, path=repo_root)
    local_head = get_head_commit_id(path=repo_root)
    tracking_head = get_head_commit_id(InstructorClassRepo.ORIGIN_TRACKING_BRANCH, path=repo_root)
    merge_branch_name = InstructorClassRepo.MERGE_STAGING_BRANCH_NAME.format(local_head[:8], tracking_head[:8])
    if is_ancestor_commit(descendant=local_head, ancestor=tracking_head, path=repo_root):
        # If the local head is a descendant of the tracking head,
        # then any upstream changes have already been merged in.
        print(f"Tracking and local heads are merged, nothing to sync...")
        return
    
    # Make certain the merge branch is empty before we start.
    try: delete_local_branch(merge_branch_name, force=True, path=repo_root)
    except: pass
    # Branch onto the merge branch off the user's head
    checkout(merge_branch_name, new_branch=True, path=repo_root)

    isonow = datetime.now().isoformat()

    # Everything in the repo root that isn't the .git folder
    file_contents = { path: path.read_bytes() for path in repo_root.rglob("*") if path.is_file() and ".git" not in path.parts }
    # These are relative to the repo root.
    untracked_files = {
        f["path"] for f in get_modified_paths(untracked=True, path=repo_root)
        if f["modification_type"] == "??"
    }
    untracked_files_dir = repo_root / f".untracked-{ isonow }"

    # Grab every overwritable path inside the repository.
    # Note: we need to do this again after the merge, since we can only pick up paths that exist on disk.
    # If the local head deleted a file, it won't be picked up in the first pass.
    # Vice-versa, if the merge head deleted a file, it won't be picked up in the second pass.
    overwritable_paths = set()
    gather_overwritable_paths() # pick up paths introduced by the local head

    # Merge the upstream tracking branch into the temp merge branch
    try:
        print(f"Merging { InstructorClassRepo.ORIGIN_TRACKING_BRANCH } ({ tracking_head[:8] }) --> { InstructorClassRepo.MAIN_BRANCH_NAME } ({ local_head[:8] }) on branch { merge_branch_name }")

        # We have to stash because git refuses to merge if the merge would overwrite local changes.
        move_untracked_files()
        stash_changes(path=repo_root)

        # Merge the upstream tracking branch into the merge branch
        merge_conflicts = git_merge(InstructorClassRepo.ORIGIN_TRACKING_BRANCH, commit=False, path=repo_root)
        gather_overwritable_paths() # pick up paths introduced by the merge head
        rename_merge_conflicts(merge_conflicts)
        
        commit(None, no_edit=True, path=repo_root)

        # After popping, we could have further conflicts between the student's local changes and the merge head
        pop_stash(path=repo_root)
        stash_conflicts = git_diff_status(diff_filter="U", path=repo_root)
        gather_overwritable_paths() # technically, not really necessary since we gather before stashing.
        rename_merge_conflicts(stash_conflicts)

    except Exception as e:
        # Cleanup the merge branch and return to main
        print("Fatal: Can't merge remote changes into professor repository", e)
        # If an error occurs, we're going to force checkout and delete so the merge head will delete regardless.
        try: abort_merge(path=repo_root)
        except:
            print("(failed to abort merge)")
        # if an error occurs after we've already popped, there won't be anything to pop on the stack.
        try: pop_stash(path=repo_root)
        except:
            print("(failed to pop stash, already popped)")
        checkout(InstructorClassRepo.MAIN_BRANCH_NAME, force=True, path=repo_root)
        delete_local_branch(merge_branch_name, force=True, path=repo_root)
        return
    
    finally:
        # It doesn't really matter when we restore these, as long as it happens post-merge.
        restore_untracked_files()
        shutil.rmtree(untracked_files_dir)

    checkout(InstructorClassRepo.MAIN_BRANCH_NAME, path=repo_root)

    # If we successfully merged it, we can go ahead and merge the temp branch into our actual branch
    try:
        print(f"Merging { merge_branch_name } --> { InstructorClassRepo.MAIN_BRANCH_NAME }")
        # Merge the merge staging branch into the actual branch, don't need to commit since fast forward
        # We don't need to check for conflicts here since the actual branch can now be fast forwarded.
        git_merge(merge_branch_name, ff_only=True, commit=False, path=repo_root)

    except Exception as e:
        # Merging from temp to actual branch failed.
        print(f"Fatal: Failed to merge the merge staging branch into actual branch", e)
        abort_merge(path=repo_root)
    
    finally:
        delete_local_branch(merge_branch_name, force=True, path=repo_root)
        
    # TODO: when websockets added, ping the client if anything was changed.

async def setup_backend(context: AppContext):
    try:
        course = await context.api.get_course()
        instructor = await context.api.get_my_user()
        await create_repo_root_if_not_exists(context)
        await create_ssh_config_if_not_exists(context, course)
        await set_git_authentication(context, course, instructor)
        await clone_repo_if_not_exists(context, course)
        await set_root_folder_permissions(context)
        while True:
            print("Pulling in upstream changes...")
            await sync_upstream_repository(context, course)
            print(f"Sleeping for { context.config.UPSTREAM_SYNC_INTERVAL }...")
            await asyncio.sleep(context.config.UPSTREAM_SYNC_INTERVAL)
    except:
        print(traceback.format_exc())

def setup_handlers(server_app):
    web_app = server_app.web_app
    BaseHandler.context = AppContext(server_app)
    
    loop = asyncio.get_event_loop()
    asyncio.run_coroutine_threadsafe(setup_backend(BaseHandler.context), loop)
    
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = [
        ("assignments", AssignmentsHandler),
        ("course_instructor_students", CourseAndInstructorAndStudentsHandler),
        ("notebook_files", NotebookFilesHandler),
        ("submit_assignment", SubmissionHandler),
        ("sync_to_lms", SyncToLMSHandler),
        ("grade_assignment", GradeAssignmentHandler),
        ("settings", SettingsHandler)
    ]

    handlers_with_path = [
        (
            url_path_join(base_url, "eduhelx-jupyterlab-prof", *(uri if not isinstance(uri, str) else [uri])),
            handler
        ) for (uri, handler) in handlers
    ]
    web_app.add_handlers(host_pattern, handlers_with_path)
