.PHONY: tailwind,hugo,clean

tailwind:
	npx tailwindcss -i assets/css/main.css -o ./static/css/style.css --watch   

hugo:
	hugo server -s exampleSite --gc --themesDir=../..

clean:
	rm -rf exampleSite/public/