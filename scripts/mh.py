import argparse
import subprocess
import os
import sys
import shutil

def set_hooks_path(hooks_dir,create):
    """
    set hooks path
    """
    try:
        if not os.path.exists(hooks_dir):
            print(f"Directory '{hooks_dir}' does not exist.")
            if create:
                print(f"Creating {hooks_dir}")
                os.makedirs(hooks_dir)
            else:
                print("Exiting...")
                sys.exit(1)

        subprocess.run(["git", "config", "core.hooksPath", hooks_dir], check=True)
        print(f"Git hooks directory set to: {hooks_dir}")
    except subprocess.CalledProcessError as e:
        print(f"Error: Failed to set Git hooks directory. {e}")
        sys.exit(1)

def reset_hooks_path():
    """
    reset git config
    """
    try:
        subprocess.run(["git", "config", "--unset", "core.hooksPath"], check=True)
        print("Git hooks directory reset to default.")
    except subprocess.CalledProcessError as e:
        print(f"Error: Failed to reset Git hooks directory. {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Manage Git hooks directory.")
    subparsers = parser.add_subparsers(dest="command")

    parser_set = subparsers.add_parser("set", help="Set a custom Git hooks directory")
    parser_set.add_argument("-d","--hooks_dir", type=str, help="Path to the custom hooks directory")
    parser_set.add_argument("-c","--create",type=bool, help="create one if not exists",default=False)
    parser_set.add_argument("-a","--add_hook",action="store_true",default=False,help="copy the hooks for typst to ")

    parser_reset = subparsers.add_parser("reset", help="Reset Git hooks directory to default")
    script_dir = os.path.dirname(__file__)

    args = parser.parse_args()

    if args.command == "set":
        set_hooks_path(args.hooks_dir,args.create)

        if args.add_hook:
            shutil.copy(f"{script_dir}/hooks/pre-commit.rel",f"{args.hooks_dir}/pre-commit")
    elif args.command == "reset":
        reset_hooks_path()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
