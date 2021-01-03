 

$("button").on('click', function() {
    console.log ("Clicking")
    window.postMessage({ type: "FROM_PAGE", text: "Hello from the webpage!" }, "*");
  })