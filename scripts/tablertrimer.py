from typing import Tuple,Dict,List
import os
import re
import mimetypes


def is_text_file(file_path):
    mime_type, _ = mimetypes.guess_type(file_path)
    return mime_type and mime_type.startswith('text')

def find_strings_in_files(folder_path:str, pattern:str,name_only=False,verbose=False):
    matches = []

    for root, dirs, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)

            if not is_text_file(file_path):
                continue
            if verbose:
                print(f"Searching {file_path}")

            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

                for line_number, line in enumerate(lines, 1):
                    for match in re.finditer(rf'{pattern}', line):
                        mg = match.group()
                        if verbose and mg:
                            print(f"In file {file_path} ,{mg} are found")
                        if name_only:
                            matches.append(match.group())
                        else:
                            matches.append((match.group(), file_path, line_number))

    return set(matches)

def parse_css_file(css_file_path:str) -> Tuple[List[str],List[str],Dict[str,str]]:
    with open(css_file_path, "r") as file:
        raw_string = file.read()

    comment_pattern = r"\/\*[\s\S]*?\*\/"
    comment_matches = re.findall(comment_pattern, raw_string, re.DOTALL)

    fontface_pattern = r"@font-face\{.*?\}"
    fontface_matches = re.findall(fontface_pattern, raw_string, re.DOTALL)

    ti_pattern = r"(\.ti[^{]*)\{([^}]*)\}"
    ti_matches = re.findall(ti_pattern, raw_string, re.DOTALL)
    ti_classes = {match[0].strip(): match[1].strip() for match in ti_matches}

    return (comment_matches,fontface_matches,ti_classes)

def generate_css_file(css_compat:Tuple[List[str],List[str],Dict[str,str]], output_file_path:str,verbose:bool=False):
    try:
        with open(output_file_path, "w",encoding="utf-8") as f:
            f.write(css_compat[0][0])
            # write font face
            f.write(css_compat[1][0])

            # write selector
            for selector, properties in css_compat[2].items():
                if verbose:
                    print(selector," + ",properties)
                f.write(f"{selector}{{")
                f.write(properties)
                f.write("}")

            f.write(css_compat[0][1])
        
        print(f"CSS file generated: {output_file_path}")
    
    except Exception as e:
        print("Error:", e)

def minify_css(in_css_path:str,out_css_path:str,include_classes=[],verbose=False):
    compat_origin_css = parse_css_file(in_css_path)

    new_prop = {}

    for ic in include_classes:
        class_name = f".{ic}:before"
        t = compat_origin_css[2].get(class_name)
        if verbose:
            print(f"for {class_name}: {t!r}")

        new_prop[class_name] = t
    new_prop[".ti"] = compat_origin_css[2].get(".ti")

    generate_css_file((compat_origin_css[0],compat_origin_css[1],new_prop),out_css_path,verbose)


# if __name__ == '__main__':
#     pattern="ti ti(-\w+)*"
#     paths = ["layouts","exampleSite"]

#     input_path = "assets/css/tabler-icons.min.css"
#     output_path = "static/css/tabler-icons.min.css"
    
#     l = []

#     for path in paths:
#         l+=find_strings_in_files(path,pattern,name_only=True,verbose=True)

#     # reshape remove ti
#     l = [i.split(" ")[1] for i in l]
#     print(l)
    
#     minify_css(input_path,output_path,l)
#     # print(parse_css_file(output_path)[2]['.ti-brand-x:before']['content'])
#     # generate_css_file(parse_css_file("./sample.css"),"./1.css")
#     # parse_css_file(input_path)
