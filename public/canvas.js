var canvas = document.getElementById("canv");
var canv = $("#canv");
var ctx = document.getElementById("canv").getContext("2d");

let hiddenInput = $('input[name="sig"]');

canv.on("mousedown", function(e) {
    let x = e.offsetX;
    let y = e.offsetY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "black";
    canv.on("mousemove", function(e) {
        x = e.offsetX;
        y = e.offsetY;
        ctx.lineTo(x, y);
        ctx.stroke();
        var secret = canvas.toDataURL();
        hiddenInput.val(secret);
    });
});

$(document).on("mouseup", function() {
    canv.off("mousemove");
});

$("#clear").on("click", function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

var sub = $("button");
sub.on("click", function() {
    var first = $('input[name="first"]').val();
    var last = $('input[name="last"]').val();
    console.log(first);
    console.log(last);
    console.log(hiddenInput);
});
