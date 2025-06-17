{
  description = "Hugo and npx";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = import nixpkgs {
            inherit system;
          };
        in
        with pkgs;
        {
          devShells = {
            default = mkShell {
              buildInputs = [ 
                hugo
                nodejs_24
                typst
                tailwindcss
              ];
              shellHook = ''
                echo "Hugo development environment"
                echo "Available: hugo, node, tailwindcss, typst, fontforge"
              '';
            };
            
            font = mkShell {
              buildInputs = [
                nodejs_20
                pnpm_8
                fontforge
                python312
                python312Packages.typer
                python312Packages.fonttools
                python312Packages.brotli
                woff2
              ];
              shellHook = ''
                echo "Font compilation environment activated"

                pnpm config set registry http://mirrors.cloud.tencent.com/npm/
                npm config set registry http://mirrors.cloud.tencent.com/npm/

                if [ -d "assets/iconfonts" ]; then
                  echo "Found assets/iconfonts directory"
                  if [ -f "assets/iconfonts/package.json" ]; then
                    echo "Installing dependencies with pnpm..."
                    cd assets/iconfonts
                    pnpm install --ignore-scripts
                    cd - > /dev/null
                    echo "Dependencies installed!"
                  else
                    echo "No package.json found in assets/iconfonts"
                  fi
                else
                  echo "assets/iconfonts directory not found"
                fi

              '';
            };
          };
        }
      );
}