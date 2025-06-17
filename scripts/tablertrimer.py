from dataclasses import dataclass
from typing import Tuple,Dict,List
import os
import re
import mimetypes
from pathlib import Path

@dataclass
class CSSCompat():
    comments:List[str]
    fontfaces:List[str]
    ti_classes:Dict[str,str]

def is_text_file(file_path):
    mime_type, _ = mimetypes.guess_type(file_path)
    return mime_type and mime_type.startswith('text')

def find_strings_in_files(path: str, pattern: str, name_only=False, verbose=False):

    matches = []
    path_obj = Path(path)
    
    if path_obj.is_file():
        if not is_text_file(str(path_obj)):
            if verbose:
                print(f"Skipping non-text file: {path_obj}")
            return set()
            
        if verbose:
            print(f"Searching file: {path_obj}")
            
        try:
            with open(path_obj, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
                for line_number, line in enumerate(lines, 1):
                    for match in re.finditer(rf'{pattern}', line):
                        mg = match.group()
                        if verbose and mg:
                            print(f"In file {path_obj}, {mg} found on line {line_number}")
                        if name_only:
                            matches.append(match.group())
                        else:
                            matches.append((match.group(), str(path_obj), line_number))
        except Exception as e:
            if verbose:
                print(f"Error reading file {path_obj}: {e}")
                
    elif path_obj.is_dir():
        for root, dirs, files in os.walk(path):
            for file in files:
                file_path = os.path.join(root, file)

                if not is_text_file(file_path):
                    continue
                if verbose:
                    print(f"Searching {file_path}")

                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()

                        for line_number, line in enumerate(lines, 1):
                            for match in re.finditer(rf'{pattern}', line):
                                mg = match.group()
                                if verbose and mg:
                                    print(f"In file {file_path}, {mg} found")
                                if name_only:
                                    matches.append(match.group())
                                else:
                                    matches.append((match.group(), file_path, line_number))
                except Exception as e:
                    if verbose:
                        print(f"Error reading file {file_path}: {e}")
    else:
        if verbose:
            print(f"Path does not exist: {path}")

    return set(matches)

def parse_css_file(css_file_path:str) -> CSSCompat:
    with open(css_file_path, "r") as file:
        raw_string = file.read()

    comment_pattern = r"\/\*[\s\S]*?\*\/"
    comment_matches = re.findall(comment_pattern, raw_string, re.DOTALL)

    fontface_pattern = r"@font-face\{.*?\}"
    fontface_matches = re.findall(fontface_pattern, raw_string, re.DOTALL)

    ti_pattern = r"(\.ti[^{]*)\{([^}]*)\}"
    ti_matches = re.findall(ti_pattern, raw_string, re.DOTALL)
    ti_classes = {match[0].strip(): match[1].strip() for match in ti_matches}

    return CSSCompat(comments=comment_matches,fontfaces=fontface_matches,ti_classes=ti_classes)

def generate_css_file(css_compat:CSSCompat, output_file_path:str,verbose:bool=False):
    try:
        with open(output_file_path, "w",encoding="utf-8") as f:
            f.write(css_compat.comments[0])
            # write font face
            f.write(css_compat.fontfaces[0])

            # write selector
            for selector, properties in css_compat.ti_classes.items():
                if verbose:
                    print("Writting ",selector," + ",properties)
                f.write(f"{selector}{{")
                f.write(properties)
                f.write("}")

            f.write(css_compat.comments[1])
        
        print(f"CSS file generated: {output_file_path}")
    
    except Exception as e:
        print("Error:", e)

def minify_css(in_css_path:str,out_css_path:str,include_classes=[],verbose=False) -> CSSCompat:
    origin_css = parse_css_file(in_css_path)

    new_prop = {}

    for ic in include_classes:
        class_name = f".{ic}:before"
        t = origin_css.ti_classes.get(class_name)
        if verbose:
            print(f"for {class_name}: {t!r}")

        new_prop[class_name] = t
    new_prop[".ti"] = origin_css.ti_classes.get(".ti")

    new_css = CSSCompat(comments=origin_css.comments,fontfaces=origin_css.fontfaces,ti_classes=new_prop)
    print(new_css)
    generate_css_file(new_css,out_css_path,verbose)

    return new_css


if __name__ == '__main__':
    pattern="ti ti(-\w+)*"
    paths = ["layouts","exampleSite"]

    input_path = "assets/css/tabler-icons.min.css"
    output_path = "static/css/tabler-icons.min.css"
    
    l = []

    for path in paths:
        l+=find_strings_in_files(path,pattern,name_only=True,verbose=True)

    # reshape remove ti
    l = [i.split(" ")[1] for i in l]
    print(l)
    
    minify_css(input_path,output_path,l)
    # print(parse_css_file(output_path)[2]['.ti-brand-x:before']['content'])
    # generate_css_file(parse_css_file("./sample.css"),"./1.css")
    # parse_css_file(input_path)
