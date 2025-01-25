# hugo-theme-piatto

## Features

## Installation

## Configuration


## Customization

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
##### 4. Run the make script
```shell
make icons
```

This will automatically detect the change and processing subsetting.

You should only run the script while releasing the site.Because this will replace the font at static.