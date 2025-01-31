/*  
====================================================================

FAST SEARCH — 
https://gist.github.com/cmod/5410eae147e4318164258742dd053993
Updated to work with fuse 7 (Jan 2025)

==================================================================== 
*/
var fuse;
var searchVisible = false; 
var firstRun = true; // allow us to delay loading json data unless search activated
var list = document.getElementById('searchResults'); // targets the <ul>
var first = list.firstChild; // first child of search list
var last = list.lastChild; // last child of search list
var maininput = document.getElementById('searchInput'); // input box for search
var resultsAvailable = false; // Did we get any search results?
var hiddengroup = document.getElementById('hidegroup');
var nores = document.getElementById('noResultsMessage');
var resultCount = document.getElementById('resultCount');

// ==========================================
// The main keyboard event listener running the show
//
document.addEventListener('keydown', function(event) {
  
  // CMD-/ to show / hide Search
  if (event.metaKey && event.key === '/') {
      // Load json search index if first time invoking search
      // Means we don't load json unless searches are going to happen; keep user payload small unless needed
      if(firstRun) {
        loadSearch(); // loads our json data and builds fuse.js search index
        firstRun = false; // let's never do this again
      }
      
      // Toggle visibility of search box
      if (!searchVisible) {
        document.getElementById("fastSearch").style.visibility = "visible"; // show search box
        document.getElementById("searchInput").focus(); // put focus in input box so you can just start typing
        searchVisible = true; // search visible
      }
      else {
        document.getElementById("fastSearch").style.visibility = "hidden"; // hide search box
        document.activeElement.blur(); // remove focus from search box 
        searchVisible = false; // search not visible
      }
  }

  // Allow ESC (27) to close search box
  if (event.key == 'Escape') {
    if (searchVisible) {
      document.getElementById("fastSearch").style.visibility = "hidden";
      document.activeElement.blur();
      searchVisible = false;
    }
  }

  // DOWN (40) arrow
  if (event.key == 'ArrowDown') {
    if (searchVisible && resultsAvailable) {
      // console.log("down");
      event.preventDefault(); // stop window from scrolling
      if ( document.activeElement == maininput) { first.focus(); } // if the currently focused element is the main input --> focus the first <li>
      else if ( document.activeElement == last ) { last.focus(); } // if we're at the bottom, stay there
      else { document.activeElement.parentElement.nextSibling.firstElementChild.focus(); } // otherwise select the next search result
    }
  }

  // UP (38) arrow
  if (event.key == 'ArrowUp') {
    if (searchVisible && resultsAvailable) {
      event.preventDefault(); // stop window from scrolling
      if ( document.activeElement == maininput) { maininput.focus(); } // If we're in the input box, do nothing
      else if ( document.activeElement == first) { maininput.focus(); } // If we're at the first item, go to input box
      else { document.activeElement.parentElement.previousSibling.firstElementChild.focus(); } // Otherwise, select the search result above the current active one
    }
  }
});


// ==========================================
// execute search as each character is typed
//
document.getElementById("searchInput").onkeyup = function(e) { 
  if(firstRun) {
    loadSearch(); // loads our json data and builds fuse.js search index
    firstRun = false; // let's never do this again
    return 
  }
  executeSearch(this.value);
}

document.getElementById('searchInput').addEventListener('blur',()=>{
  nores.classList.add('hidden');
})


// ==========================================
// fetch some json without jquery
//
function fetchJSONFile(path, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = function() {
      if (httpRequest.readyState === 4) {
          if (httpRequest.status === 200) {
              var data = JSON.parse(httpRequest.responseText);
              if (callback) callback(data);
          }
      }
  };
  httpRequest.open('GET', path);
  httpRequest.send(); 
}


// ==========================================
// load our search index, only executed once
// on first call of search box (CMD-/)
//
function loadSearch() {
  console.log("initializing search")
  fetchJSONFile('/index.json', function(data){

      var options = { // fuse.js options; check fuse.js website for details
        shouldSort: true,
        location: 0,
        distance: 100,
        threshold: 0.4,
        minMatchCharLength: 2,
        keys: [
          'title',
          'permalink',
          'description',
          'section',
          'categories',
          'tags'
          ]
      };

      fuse = new Fuse(data, options); // build the index from the json file
      
  });
}


// ==========================================
// using the index we loaded on CMD-/, run 
// a search query (for "term") every time a letter is typed
// in the search box
//
function executeSearch(term) {
  let results = fuse.search(term); // the actual query being run using fuse.js
  let searchitems = ''; // our results bucket

  if (results.length === 0) { // no results based on what was typed into the input box
    resultsAvailable = false;
    searchitems = '';
    hiddengroup.classList.add("hidden")
    nores.classList.remove('hidden')
  } else { // build our html 
    resultCount.textContent = results.length;
    for (let item in results.slice(0, 5)) {
      // Note the extra `.item` property in the references below
      searchitems +=
        '<li class="searchcard"><a href="' +
        results[item].item.permalink +
        '" tabindex="0">' +
        '<span class="cardtitle">' +
        results[item].item.title +
        '</span><br /> '+
        '<span class="carddesc">'+results[item].item.description + '</span>' +
        '</a></li>';
    }
    resultsAvailable = true;
    hiddengroup.classList.remove('hidden')
    nores.classList.add("hidden")
  }
  
  document.getElementById("searchResults").innerHTML = searchitems;
  if (results.length > 0) {
    first = list.firstChild.firstElementChild; // first result container — used for checking against keyboard up/down location
    last = list.lastChild.firstElementChild; // last result container — used for checking against keyboard up/down location
  }
}
