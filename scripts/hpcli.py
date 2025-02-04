import argparse
from typing import Callable
import sys
import subprocess
from pathlib import Path
from datetime import datetime
import os
import shutil
import json

DEPENDENCE = {
    "yaml": "PyYAML",
    "typer":"typer"
}

META_DATA = {
    "title": ("Title of the new post",str),
    "description": ("Description of the post",str),
    "tags": ("Tags of the post",list,[]),
    "categories": ("Category of the post", list,[]),
    "date": ("Date of the post", str, datetime.now().strftime("%Y-%m-%d")),
    "withToc": ("Show table of contents",bool,True),
    "cover": ("Cover images of the post",str,""),
    "keepOrigin":("Keep the origin cover img instead of resize it.(May cause long-loading-time issue)",bool,False),
    "typst":("Enable typst for the post",bool,False),
    "noWordTime":("Don't show WrodCount and reading time.(Will be true while typst is sat to true)",bool,False),
    "katex":("Enable Katex for the post",bool,False)
}

APPEND_DATA = {

}

def copy_folder(src: Path, dst: Path):

    dst.mkdir(parents=True, exist_ok=True)

    for item in src.iterdir():
        if item.is_dir():
            copy_folder(item, dst / item.name)
        else:
            shutil.copy2(item, dst / item.name)

def save_front_matter(file_path: Path, data: dict, format: str = 'yaml',v=False) -> None:
    try:
        import yaml
    except ImportError as ie:
        print(f"Failed to import module, {ie}")

    if format == 'yaml':
        front_matter = yaml.dump(data, sort_keys=False, allow_unicode=True)
        front_matter = f"---\n{front_matter}---\n"
    else:
        raise ValueError("Unsupported format. Use 'yaml'.")
    if v: print(f"[Front Matter] Writting to {file_path} ")
    with file_path.open('w', encoding='utf-8') as file:
        file.write(front_matter)

def install_dep(packages, mirror="https://pypi.tuna.tsinghua.edu.cn/simple/"):
    for human_pack_name, pypi_pack_name in packages.items():
        try:
            __import__(human_pack_name)
        except ImportError:
            print(f"{human_pack_name} not installed. Installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", f"--index={mirror}", pypi_pack_name])

def get_python():
    """
    Get py exec and py version
    """
    return {
        "interpreter_path": sys.executable,
        "python_version": sys.version.split()[0],
    }

def init(args):
    """
    init subcommand function
    """
    print("Initializing theme")

    print("Checking dependencies")
    print(f"Following dependencies are needed for compiling typst or edit theme\n {DEPENDENCE}")
    if ask_question(f"Should We check and install them?",bool,True):
        install_dep(DEPENDENCE)

    print("Basic setup")
    
    print("Coping hugo.toml")
    shutil.copy("themes/piatto/exampleSite/hugo.toml","./hugo.toml")

    print("Setting up contents")
    content_dir = Path("content")
    os.mkdir(content_dir / "me")
    me_data = {
        "title": "About Me",
        "description": "Some personal information",
        "date": datetime.now().strftime("%Y-%m-%d")
    }
    save_front_matter(content_dir / "me" / "index.md",me_data,v=True)
    os.mkdir(content_dir / "articles")
    os.mkdir(content_dir / "projects")
    project_info = {
        "title": "Projects",
        "description": "Some Projects."
    }
    save_front_matter(content_dir / "projects" / "_index.md", project_info, v=True)
    data_path = Path("data")
    if not data_path.exists(): os.mkdir(data_path)
    template_data = [{
      "name": "Bear Notes",
      "description": "Quick note taking application on Mac for writing down instant thoughts, application on Mac for writing down instant thoughts",
      "link": "https://bear.app/",
      "icon": "https://blog.bear.app/wp-content/uploads/2018/10/bear-icon.png",
      "tag": ["Productivity"],
      "status": "Working"
    }]
    with open("data/projects.json","w",encoding="utf-8") as f:
        json.dump(template_data, f)

    print("Doing script setup")
    os.mkdir(Path("scripts"))
    copy_folder(Path("themes/piatto/scripts"),Path("scripts"))

    print("Setting hook for typst to compile automatically.")
    subprocess.check_call(["python","scripts/mh.py","set","-d","themes/piatto/scripts/hooks"])

    print("Done")
    

def new(args):
    content_floder = Path("./content/articles")
    if args.overwrite_dir: content_floder = Path(args.overwrite_dir)
    meta_data = {}
    for k,v in META_DATA.items():
        meta_data[k] = ask_question(*v)

    title = meta_data.get("title")
    arcticle_dir:Path = content_floder / title.lower().replace(" ","-")
    if arcticle_dir.exists():
        print(f"Error: Post with title {title} already exists.")
        exit(-1)
    
    print(f"\nCreating new posts at {arcticle_dir}")

    os.mkdir(arcticle_dir)
    os.mkdir(arcticle_dir / "images")

    if meta_data['typst']:
        meta_data['noWordTime'] = True
        meta_data['withToc'] = False

        typ = arcticle_dir / "main.typ"

        typ.write_text("\n",encoding="utf-8")

    save_front_matter(arcticle_dir / "index.md",meta_data,v=True)
    

def ask_question(prompt: str, type: Callable, default=None):
    """
    Helper function to ask a question and validate the input type.
    - For bool types, use y/n with an optional default value.
    - For list types, accept comma-separated values and return a list.
    """
    while True:
        # Add default value to prompt
        if type == bool: prompt += " (using y/n)"
        if default is not None:
            prompt += f" [default: {default}] "
        prompt+=": "

        user_input = input(prompt).strip()
        if type != str: user_input = user_input.lower()

        # Handle empty input for default values
        if user_input == "" and default is not None:
            return default

        # Handle bool type specifically
        if type == bool:
            if user_input in ('y', 'yes'):
                return True
            elif user_input in ('n', 'no'):
                return False
            else:
                print("Invalid input, please enter 'y' or 'n'.")
        elif type == list:
            if user_input == "":
                return []  # Return empty list if input is empty
            try:
                # Split by comma and strip whitespace from each item
                return [item.strip() for item in user_input.split(",")]
            except Exception:
                print("Invalid input, please enter a comma-separated list.")
        else:
            try:
                return type(user_input)
            except ValueError:
                print(f"Invalid input, please enter a valid {type.__name__}.")

def main():
    parser = argparse.ArgumentParser(description="A simple command-line application.")
    parser.add_argument("-v", "--verbose", action="store_true", help="increase output verbosity")
    subparsers = parser.add_subparsers(dest="command", help="sub-command help")

    # Init subcommand
    parser_init = subparsers.add_parser("init", help="initialize something")
    parser_init.set_defaults(func=init)

    # New subcommand
    parser_new = subparsers.add_parser("new", help="create new posts")
    parser_new.add_argument("-d","--overwrite_dir",help="Overwrite content dir")
    parser_new.set_defaults(func=new)

    args = parser.parse_args()

    if args.verbose:
        print("Verbose mode is on.")

    if hasattr(args, 'func'):
        args.func(args)

        # Example of asking questions
        if args.command == "init":
            pass
            # name = ask_question("Enter your name: ", str)
            # is_ready = ask_question("Are you ready? (y/n): ", bool, default=True)
            # print(f"Name: {name}, Ready: {is_ready}")
        elif args.command == "new":
            pass
            # project_name = ask_question("Enter project name: ", str)
            # use_template = ask_question("Use template? (y/n): ", bool, default=False)
            # print(f"Project Name: {project_name}, Use Template: {use_template}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()