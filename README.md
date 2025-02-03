# hugo-theme-piatto

## Features

- Search
- Typst as blog src

## Installation

To use the theme, you should add it as a sub-module

```bash
git submodule addhttps://github.com/zentialEdwardSu/hugo-theme-piatto.git themes/piatto
# Or to update to the latest version
git submodule update --remote
# theme init(Sync dir srtuct and do some setup)
python themes/piatto/scripts/hpcli.py init
```

## New Posts

To create a new post, just run

```bash
python scripts/hpcli.py new
```

or just create the floder and index.md yourself. Just remember `main.typ` should always be the entry of your typst documents. 

## Typst guidence

When using typst, you need to pay attention to the top, bottom, left and right margins.

## Configuration

read the comments in `hugo.toml` in the root dir of your site

## Customization

> **Note**:
> All scripts below should be run from the root directory of your theme.

### styles

run

```bash
 make tailwind-dev  
```

and just edit the class name of the html elements


### fonts

#### Make some changes

```shell
make icons-dev
```

This will copy a full character set to static for easy development. Than you can search any icons at [tabler](https://tabler.io/icons).

To add icons you selected to the layouts, just use as the template below
```html
<i class="ti ti-{$name_of_icon} ...other tailwind classes...">
```

#### Apply the changes

Because we use tabler icons packaged as fonts, the usual font subsetting method does not work on tabler-icons.woff2. Any operation on the icon other than deleting it needs to be compiled from the source code of tabler-icons.

##### 1. Install fontforge
##### 2. Init and update the submodule, so we have the local tabler-icons source tree
##### 3. Apply the patch, this make compile options avaliable for tabler-icons
```shell
patch -p < patch.diff
```
##### 4. Run the make script
```shell
make icons
```

This will automatically detect the change and processing subsetting.

You should only run the script while releasing the site.Because this will replace the font at static.


## Citations

Without the reference and help of these websites, piatto would not be complete.

- The idea of ​​writing piatto came from this theme: https://github.com/paulmartins/hugo-digital-garden-theme.git
- bilibili shortcodes and style of light/dark switch comes from: https://github.com/tomowang/hugo-theme-tailwind.git
- hint shorcode comes from: https://github.com/alex-shpak/hugo-book.git
- searching relies on the guidance of this blog to achieve: https://gist.github.com/cmod/5410eae147e4318164258742dd053993