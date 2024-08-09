import json
import nbformat
from pathlib import Path
from otter.assign.r_adapter import rmarkdown_converter
from otter.assign.assignment import Assignment
from otter.assign.blocks import is_assignment_config_cell, get_cell_config
from otter.utils import dump_yaml, NBFORMAT_VERSION as OTTER_NBFORMAT_VESRION

class AssignConfigDoesNotExistException(Exception):
    message = "Assign config is not embedded in any notebook cells"

class OtterAssignUtil:
    def __init__(self, notebook_path: Path):
        self.assignment = Assignment()
        self.assignment.master = notebook_path
        if self.assignment.is_rmd:
            self.notebook = rmarkdown_converter.read_as_notebook(notebook_path)
        else:
            self.notebook = nbformat.read(notebook_path, as_version=OTTER_NBFORMAT_VESRION)

    def save(self, to_path: str | None=None):
        if self.assignment.is_rmd:
            rmarkdown_converter.write_as_rmd(self.notebook, to_path)
        else:
            nbformat.write(self.notebook, to_path or self.assignment.master)

    def update_assign_config(self, config: dict):
        try:
            cell, existing_config = self._get_assign_config_cell(), self.get_assign_config()
        except AssignConfigDoesNotExistException:
            cell = nbformat.from_dict({ "cell_type": "raw", "metadata": {}, "outputs": [], "source": "" })
            self.notebook.cells.insert(0, cell)
            existing_config = {}
        
        existing_config.update(config)
        
        yaml_config = dump_yaml(existing_config)
        cell.source = f"# ASSIGNMENT CONFIG\n{ yaml_config }"


    def _get_assign_config_cell(self) -> nbformat.NotebookNode:
        for cell in self.notebook.cells:
            if is_assignment_config_cell(cell): return cell
        raise AssignConfigDoesNotExistException

    def get_assign_config(self) -> dict:
        return get_cell_config(self._get_assign_config_cell())