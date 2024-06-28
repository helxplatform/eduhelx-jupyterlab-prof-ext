import os
import shutil
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
        student_notebook_dist_path = dist_path / "student" / master_notebook_path.name

        otter_assign(master_notebook_path, dist_path, no_pdfs=True)
        shutil.move(student_notebook_dist_path, student_notebook_path)
        shutil.rmtree(dist_path)
    
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