.PHONY: tailwind,hugo,clean,vercel

tailwind:
	npx tailwindcss -i assets/css/main.css -o ./static/css/style.css --watch   

hugo:
	hugo server -s exampleSite --gc --themesDir=../..

clean:
	rm -rf exampleSite/public/

vercel:
	pwd
	echo "build ${SITE_URL} with theme $(basename "${PWD}")";
	hugo -s exampleSite --gc -b ${SITE_URL} -t $(basename "${PWD}") --themesDir=../.. && mv ./exampleSite/public ./
	echo "moving build dir to wrokroot"
	mv ./exampleSite/public ./
	echo "done"
	ls