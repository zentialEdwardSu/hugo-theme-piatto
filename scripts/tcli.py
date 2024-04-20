from typing_extensions import Annotated
from tablertrimer import *
from typing import List
from pathlib import Path
import time
import typer

app = typer.Typer()
state = {"verbose": False}

@app.callback()
def main(verbose: Annotated[bool ,typer.Option("-v","--verbose",help="Verbose output")]= False):
    """
    tcli is a CLI wrapper for tablertrimer, use `python tcli.py [COMMAND] --help"
    to get further information
    """
    if verbose:
        print("Will write verbose output")
        state["verbose"] = True

@app.command(help="Minify the tabler.min.css")
def trim(
        paths: Annotated[List[Path], typer.Argument(help="Path of the to-be-match-ti-class floder, can be mutiple floder")],
        input_path:Annotated[Path,typer.Option("-i","--input_path",
                                               help="Path for tabler-icons.min.cs",
                                               )] = "assets/css/tabler-icons.min.css",
        output_path:Annotated[Path,typer.Option("-o","--output_path",
                                               help="Path for trimed tabler-icons.min.cs",
                                               )] = "static/css/tabler-icons.min.css",
        watch_interval:Annotated[float,typer.Option("-w","--watch",
                                               help="Watch files in paths, synchronize ticlass changes at intervals(seconds)",
                                               )] = -1,
    ):
    pattern="ti ti(-\w+)*"
    old_l = []
    if watch_interval > 0:
        typer.echo(f"Start to watch on {paths}")
    while True:
        l = []

        for path in paths:
            l+=find_strings_in_files(path,pattern,name_only=True,verbose=state["verbose"])

        # reshape remove ti
        l = [i.split(" ")[1] for i in l]
        if state["verbose"]:
            print(l)

        if l != old_l:
            minify_css(input_path,output_path,l)
            typer.echo(f"These new classes {[x for x in l if not x in old_l]} are synced to {output_path}")
            old_l = l

        if watch_interval < 0:
            break
        else:
            old_l = l
            time.sleep(watch_interval)

@app.command(help="For debug, try to match All tabler class")
def match(
        paths: Annotated[List[Path], typer.Argument(help="Path of the to-be-match floder, can be mutiple floder")],
        name_only: Annotated[bool,typer.Option("-n","--name_only",
                                               help="whether to show where the match group are founded",
                                               )] = False
        ):
    if paths == []:
        paths = ['./']
    pattern="ti ti(-\w+)*"
    for path in paths:
        typer.echo(f"Matching under {path}")
        m = find_strings_in_files(path,pattern,name_only,state["verbose"])
        typer.echo(m)

if __name__ == '__main__':
    app()