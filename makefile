.PHONY: tailwind,hugo,clean,vercel,font

tailwind-dev:
	npx tailwindcss -i assets/css/main.css -o ./static/css/style.css --watch   

hugo-dev:
	hugo server -s exampleSite --gc --themesDir=../..

icons-dev:
	cp assets/devfonts/tabler-icons.woff2 static/webfonts/tabler-icons.woff2
	cp assets/css/tabler-icons.min.css static/css/tabler-icons.min.css

icons:
	python scripts/tcli.py -v trim exampleSite layouts --co_out_path assets/iconfonts/packages/icons-webfont/compile-options.json
	echo "building fonts"
	cd assets/iconfonts/packages/icons-webfont && pwd &&npm run clean && npm run build:prepare && npm run build:outline && npm run build:webfont
	echo "Copy to static dir"
	cp assets/iconfonts/packages/icons-webfont/dist/fonts/tabler-icons.woff2 static/webfonts/tabler-icons.woff2
	echo "job done"

clean:
	rm -rf exampleSite/public/

vercel:
	pwd
	echo "build ${SITE_URL} with theme $(basename "${PWD}")";
	hugo -s exampleSite --gc -b ${SITE_URL} -t $(basename "${PWD}") --themesDir=../..
	echo "moving build dir to wrokroot"
	mv ./exampleSite/public ./
	echo "done"
	ls