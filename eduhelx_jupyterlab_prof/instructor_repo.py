import os
import shutil
import json
import tempfile
from .otter_util import OtterAssignUtil
from otter.assign import main as otter_assign
from pathlib import Path

class NotInstructorClassRepositoryException(Exception):
    pass

class NotInAnAssignmentException(Exception):
    pass


""" Note: this class is naive to the fixed repo path. It is designed for
relative interaction with class repository filepaths WHILE inside the repository. """
class InstructorClassRepo:
    FIXED_REPO_ROOT = "eduhelx/{}-prof" # <class_name>
    ORIGIN_REMOTE_NAME = "origin"
    # Local branch
    MAIN_BRANCH_NAME = "main"
    # We have to do a merge to sync changes. We stage the merge on a separate branch
    # to proactively guard against a merge conflict.
    MERGE_STAGING_BRANCH_NAME = "__temp__/merge_{}-from-{}" # Formatted with the local head and tracking head commit hashes
    ORIGIN_TRACKING_BRANCH = f"{ ORIGIN_REMOTE_NAME }/{ MAIN_BRANCH_NAME }"

    def __init__(self, course, assignments, current_path):
        self.course = course
        self.assignments = assignments
        self.current_path = os.path.realpath(current_path)
        
        self.repo_root = self._compute_repo_root(self.course["name"], self.current_path)
        self.current_assignment = self._compute_current_assignment(self.assignments, self.repo_root, self.current_path)
    
    @property
    def current_assignment_path(self) -> Path | None:
        if self.current_assignment is None: return None
        return self.get_assignment_path(self.current_assignment)

    def get_assignment_path(self, assignment):
        return self.repo_root / assignment["directory_path"]
    
    def create_student_notebook(self):
        if self.current_assignment is None:
            raise NotInAnAssignmentException()
        
        assignment = self.current_assignment
        master_notebook_path = self.current_assignment_path / assignment["master_notebook_path"]
        student_notebook_path = self.current_assignment_path / assignment["student_notebook_path"]
        dist_path = self.current_assignment_path / f"{ assignment['name'] }-dist"
        student_notebook_dist_path = dist_path / "student" / student_notebook_path.name

        otter_config_path = self.current_assignment_path / "otter_grading_config.json"
        otter_config_dist_path = dist_path / "autograder" / "otter_config.json"
        
        assign_util = OtterAssignUtil(master_notebook_path)
        with tempfile.TemporaryDirectory() as dir:
            temp_dist_path = Path(dir) / "dist"
            processed_master_notebook_path = Path(dir) / self.current_assignment_path.name / student_notebook_path.name
            assign_util.update_assign_config({
                "init_cell": True,
                "generate": {
                    "zips": False,
                    "pdf": True,
                },
                "export_cell": None
            })

            shutil.copytree(self.current_assignment_path, processed_master_notebook_path.parent)
            assign_util.save(processed_master_notebook_path)
            otter_assign(processed_master_notebook_path, temp_dist_path, no_pdfs=True)
            # Bug with otter where it tries to create every single directory in the relative path
            # between the notebook and the dist. If these are in different top-level directories,
            # it's going to try to create folders it almost certainly lacks permission to tamper with.
            shutil.move(temp_dist_path, dist_path)

        # Move default otter config for the assignment if it doesn't exist
        if not otter_config_path.exists():
            otter_config_dist_path.rename(otter_config_path)
        # Process student notebook
        shutil.move(student_notebook_dist_path, student_notebook_path)

        # with open(student_notebook_path, "r") as f:
        #     student_notebook = json.load(f)
        #     for cell in student_notebook["cells"]:
        #         # Since we rename the notebook, need to replace the references to the old name.
        #         cell["source"] = [line.replace(master_notebook_path.name, student_notebook_path.name) for line in cell["source"]]
        # with open(student_notebook_path, "w") as f:
        #     json.dump(student_notebook, f)

        shutil.rmtree(dist_path)

    def get_protected_file_paths(self, assignment) -> list[Path]:
        files = []
        for glob_pattern in assignment["protected_files"]:
            files += self.get_assignment_path(assignment).glob(glob_pattern)
        return files
    
    @classmethod
    def _compute_repo_root(cls, course_name, current_path: str | None=None):
        """ Validates that user is in the repository root if current_path is provided """
        repo_root = Path(cls.FIXED_REPO_ROOT.format(course_name.replace(" ", "_")))
        if current_path is not None:
            try:
                Path(os.path.realpath(current_path)).relative_to(os.path.realpath(repo_root))
            except ValueError:
                raise NotInstructorClassRepositoryException()
        return repo_root

    @staticmethod
    def _compute_current_assignment(assignments, repo_root, current_path):
        current_assignment = None
        for assignment in assignments:
            assignment_path = Path(os.path.join(
                os.path.realpath(repo_root),
                assignment["directory_path"]
            ))
            if assignment_path.resolve() == Path(current_path).resolve() or assignment_path in Path(current_path).parents:
                current_assignment = assignment
                break

        return current_assignment