{
  description = "Piatto Hugo theme development environment";

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
              ];
              shellHook = ''
                echo "Hugo development environment"
                echo "Available: hugo, node, npm"
                echo "Run npm ci, then npm run dev"
              '';
            };
          };
        }
      );
}
