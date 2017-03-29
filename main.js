// import ReactDOM from 'react-dom'
// import React from 'react'
//import hashLocMap from './hashLocMap'

require("babel-core/register");
require("babel-polyfill");

var d3 = require('d3');
// var d3_force = require('d3-force');
// var d3_drag = require('d3-drag');
// d3 = Object.assign(d3, d3_force);
// d3 = Object.assign(d3, d3_drag);
var worker = require('worker!./src/Astar');
var _worker = new worker;

const SIZE = 20;

var width = window.screen.width, height = window.screen.height;

var renderer = PIXI.autoDetectRenderer(width, height, {antialias: true, backgroundColor: 0xEEEEEE});
document.getElementById('canvas').appendChild(renderer.view);

// create the root of the scene graph
var stage = new PIXI.Container();

stage.interactive = true;

/* -------------------- */

//const start_state = [5, 6, 3, 1, 4, 2, 8, 7, 0],
//const start_state = [6, 4, 2, 0, 8, 5, 3, 1, 7],
const start_state = [8,6,4,0,1,3,5,7,2],
        goal_state  = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var start_hash, goal_hash;

_worker.postMessage({ msg: 'start', start_state: start_state, goal_state: goal_state});

var d3nodes = [], d3links = [];

var ll;

window.simulation = d3.forceSimulation(d3nodes)
    .force("charge", d3.forceManyBody().strength(-50))
    .force("link", ll = d3.forceLink(d3links).distance(20).iterations(5).id(function(d) { return d.hash; }))
    //.force('center', d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width *0.35))
    .force("y", d3.forceY(height *0.5))
    .on('tick', redraw);

const color = {
    start: 0xC90205,
    goal: 0x17AD00,
    default: 0x0059C6,
    frontier: 0xFF8438
}

function generateNodeTexture(color, size = 3) {
    var circle = new PIXI.Graphics();
    circle.lineStyle(0);
    circle.beginFill(color, 1);
    circle.drawCircle(size, size ,size);
    return circle.generateTexture(size*2, PIXI.SCALE_MODES.DEFAULT);
}

var node_texture = {
    default: generateNodeTexture(color.default),
    start: generateNodeTexture(color.start, 4),
    goal: generateNodeTexture(color.goal, 4),
    frontier: generateNodeTexture(color.frontier)
}

//redraw();

var links = new PIXI.Graphics();
stage.addChild(links);

var nodes = {};
var counter = 0;

var solution_edges = {};

_worker.onmessage = function({ data }) {

    console.log(++counter);

    console.log(data);

    if (data.msg === 'solution') {
        console.log(data.path);
        for (var i = 1; i < data.path.length; i++)
            solution_edges[data.path[i-1]+','+data.path[i]] = true;
    }

    else if (data.msg === 'done') {
        clearInterval(interval);
        _worker.postMessage({ msg: 'get_solution' } );
    }

    else if(data.msg === 'start') {
        start_hash = data.start;
        goal_hash = data.goal;
    }

    else if(data.msg === 'dequeue') {
        let hash = data.hash;
        if (hash !== goal_hash) 
            nodes[hash].setTexture(node_texture['default']);
    }

    else if (data.msg == 'step') {
        var from_hash = data.from, to_hash = data.to;
        var from, to, link;
        
        if(!nodes[from_hash]) {
            console.log(nodes)
            from = new PIXI.Sprite(
                from_hash == start_hash ?
                node_texture['start']: node_texture['frontier']);

            from.x = width / 2; from.y = height / 2;

            from.hash = from_hash;
            from.state = data.state_from;

            nodes[from_hash] = from;
            d3nodes.push(from);
            stage.addChild(from);
        }
        else from = nodes[from_hash];

        if(!nodes[to_hash]) {
            to = new PIXI.Sprite(
                to_hash == goal_hash ?
                node_texture['goal']: node_texture['frontier']);;

            to.x = from.x; to.y = from.y;

            to.hash = to_hash;
            to.state = data.state_to;

            nodes[to_hash] = to;
            d3nodes.push(to);
            stage.addChild(to);
        }
        else to = nodes[to_hash];

        from.g = data.g_from; to.g = data.g_to;
        from.h = data.h_from; to.h = data.h_to;

        //console.log(data.g);
        to.alpha = to_hash === goal_hash ? 1: 0.85; //1: 0.15 + 0.85 * data.g_to / 31 ;

        d3links.push({ source: from.hash, target: to.hash });

        simulation.nodes(d3nodes);
        ll.links(d3links);
        // simulation.force('link', ll);
        simulation.alphaTarget(0.3).restart();
    }
}

function onDragStart(e) {
    console.log('drag start');
    this.data = e.data;
    //this.fixed = true;
    //simulation.gravity(0);
    this.dragging = true;
}

function onDragEnd(e) {
    console.log('drag end');
    this.data = null;
    this.fixed = false;
    this.dragging = false;
}

function onDragMove(e) {
    //console.log('drag move');
    console.log(this.fixed,this);
    if(this.dragging) {
        var newPosition = this.data.getLocalPosition(this.parent);
        this.x = newPosition.x;
        this.y = newPosition.y;
        simulation.resume();
    }
}

function step() {
    _worker.postMessage( { msg: 'step' });    
} 

var interval;
function run(pause = 30) {
    interval = setInterval(step, pause);
}

window.run = run;

function dashLine(x,y,x2,y2,dashArray){
    if (!dashArray) dashArray=[7,3];
    if (dashLength==0) dashLength = 0.001; // Hack for Safari
    var dashCount = dashArray.length;
    links.moveTo(x, y);
    var dx = (x2-x), dy = (y2-y);
    var slope = dx ? dy/dx : 1e15;
    var distRemaining = Math.sqrt( dx*dx + dy*dy );
    var dashIndex=0, draw=true;
    while (distRemaining>=0.1){
      var dashLength = dashArray[dashIndex++%dashCount];
      if (dashLength > distRemaining) dashLength = distRemaining;
      var xStep = Math.sqrt( dashLength*dashLength / (1 + slope*slope) );
      if (dx<0) xStep = -xStep;
      x += xStep
      y += slope*xStep;
      links[draw ? 'lineTo' : 'moveTo'](x,y);
      distRemaining -= dashLength;
      draw = !draw;
    }
}

//requestAnimationFrame(redraw);
function redraw() {
  //  requestAnimationFrame(redraw);
    console.log('redraw');

    links.clear();
    // console.log(d3links);

    d3links.forEach(function(link) {
        var on_solution = link.source.hash + ',' + link.target.hash in solution_edges;
        var alpha = on_solution ? 0.7 : 0.3;
        var color = on_solution ? 0x00AFEA : 0;
        links.lineStyle(2, color, alpha);
        if (link.target.g - link.source.g >= 1) {
            links.moveTo(link.source.x + 3, link.source.y + 3);
            links.lineTo(link.target.x + 3, link.target.y + 3);
        }
        else {
            dashLine(link.source.x+3, link.source.y+3, link.target.x+3, link.target.y+3);
        }
    })

  renderer.render(stage);

  //requestAnimationFrame(redraw);
}

stage.on('mousemove', function(e) {
    var pos = e.data.global;
    var a = document.getElementById('canvas'), d = simulation.find(pos.x , pos.y, 20);
    if (!d) return a.removeAttribute("href"), a.removeAttribute("title");
    a.setAttribute("title", d.hash + '\n' + d.state.join(' '));
    var blocks = document.getElementById('blocks').children;
    for(var i = 0; i < 9; i++) {
        blocks[i].innerHTML = d.state[i] == 0 ? ' ' : d.state[i];
        if(d.state[i] == 0)
            blocks[i].className += ' space';
        else
            blocks[i].className = 'block';
    }
    document.getElementById('hash').innerHTML = d.hash;
    document.getElementById('g').innerHTML = d.g;
    document.getElementById('h').innerHTML = d.h;
})

d3.select(renderer.view)
  .call(d3.drag()
      .container(renderer.view)
      .subject(dragsubject)
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

function dragsubject() {
    return simulation.find(d3.event.x, d3.event.y, 15);
}

function dragstarted() {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  simulation.fix(d3.event.subject);
}

function dragged() {
  simulation.fix(d3.event.subject, d3.event.x, d3.event.y);
}

function dragended() {
  if (!d3.event.active) simulation.alphaTarget(0);
  simulation.unfix(d3.event.subject);
}

console.log('here');

window.redraw = redraw;
window.step = step;
window.stage = stage;
window.run = run;

document.getElementById('btnstep').onclick = ()=>step();
var it;
document.getElementById('btnrun').onclick = function(){
    clearInterval(it);
    var ms = +document.getElementById('speed').value;
    console.log(ms);
    it = setInterval(step, ms);
};
document.getElementById('btnpause').onclick = ()=>clearInterval(it);