import argparse
import os
from pathlib import Path
from typing import List
import yaml
# import toml
import re
import subprocess
import datetime

def save_front_matter(file_path: Path, data: dict, format: str = 'yaml',v=False) -> None:
    if format == 'yaml':
        front_matter = yaml.dump(data, sort_keys=False, allow_unicode=True)
        front_matter = f"---\n{front_matter}---\n"
    # elif format == 'toml':
    #     front_matter = toml.dumps(data)
    #     front_matter = f"+++\n{front_matter}+++\n"
    else:
        raise ValueError("Unsupported format. Use 'yaml'.")
    if v: print(f"[Front Matter] Writting to {file_path} ")
    with file_path.open('w', encoding='utf-8') as file:
        file.write(front_matter)

def remove_fill_attributes(directory: Path,v = False):
    fill_pattern = r'fill="(?:#ffffff|#000000)"'

    for file_path in directory.rglob("*.svg"):
        if v:print(f"[SVG] Try to remove fill attr from file: {file_path}")

        content = file_path.read_text(encoding="utf-8")

        content = re.sub(fill_pattern, " ", content)

        file_path.write_text(content, encoding="utf-8")

def parse_front_matter(content):
    front_matter_pattern = re.compile(r'^(?:---|\+\+\+)\n(.*?)\n(?:---|\+\+\+)\n', re.DOTALL)
    match = front_matter_pattern.search(content)
    
    if not match:
        return None
    
    front_matter = match.group(1).strip()
    
    if match.group(0).startswith('---'):
        return yaml.safe_load(front_matter)
    else:
        return toml.loads(front_matter)

def read_markdown_file(file_path:Path):
    content = file_path.read_text(encoding='utf-8')
    
    front_matter = parse_front_matter(content)
    return front_matter

def find_folders_with_file(directory:Path, target_file:str,v:bool = False) -> List[Path]:
    folders_with_file = []
    for f in directory.rglob('*'):
        if (f.is_dir() and (f / target_file).exists()):# for searching in articles/
            folders_with_file.append(f)
            if v: print(f"[Walker] Adding {f if f.is_dir() else f.parent} to index.md Set")            
        if (f.is_file() and f.name == target_file): # for specfic file
            folders_with_file.append(f.parent)
            if v: print(f"[Walker] Adding {f.parent} to indexmd Set") 
    return set(folders_with_file)

def main():
    parser = argparse.ArgumentParser(description="tools use to build typst source files")
    parser.add_argument('-v', '--verbose', action='store_true', help="Enable Verbose",default=False)
    parser.add_argument('-d','--delfill',help="Just del fill",action='store_true',default=False)
    parser.add_argument('-i', '--input', type=str, required=True, help="Where Content dir")

    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"Error: Input dir '{args.input}' does not exist.")
        return
    
    v = args.verbose

    if args.verbose:
        print(f"Input dir: {args.input}")
    
    target_file = "index.md"
    for index_folder in find_folders_with_file(Path(args.input), target_file,v):
        index_md = index_folder / target_file
        image_dir = index_folder / "images"
        typ_src = index_folder / "main.typ"
        output_svg = image_dir / "page-{0p}.svg"

        front_matter = read_markdown_file(index_md)

        if not front_matter.get("typst", False):
            if v:
                print(f"[Typst Check]Skipping {index_folder} for typst not enabled.")
            continue
        
        if not args.delfill:
            r = subprocess.Popen(["typst","compile","-f","svg",typ_src,output_svg])
            if r.wait() != 0: print(f"Error occurred when compiling typst, {r.returncode}")

            # update build time
            front_matter['build_time'] = datetime.datetime.now().strftime("%Y-%m-%d")
            save_front_matter(index_md,front_matter,v=v)

        remove_fill_attributes(image_dir,v)

if __name__ == "__main__":
    main()