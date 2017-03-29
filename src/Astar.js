"use strict"

require("babel-core/register");
require("babel-polyfill");


var PriorityQueue = require('js-priority-queue');

const N = 3, M = 3; // colums, rows
const SIZE = N * M;

const u8 = Uint8Array;

// const start_state = new u8([0,2,3,1,4,5,6,7,8]);
// const goal_state =  new u8([0,1,2,3,4,5,6,7,8]);

const p2x = new u8([
	0,1,2,
	0,1,2,
	0,1,2
]);
const p2y = new u8([
	0,0,0,
	1,1,1,
	2,2,2
]);

/* utility functions */

function hash(state) { 
	var cnt, base = 1;
	var ind = 0;
	for(var i = 1; i < SIZE; i++) {
		cnt = 0;
		base *= i;
		for(var j = 0; j < i; j++) {
			if (state[j] < state[i])
				cnt++;
		}
		ind += cnt*base;
	}
	return ind;	
}

function print(s) {
	console.log(s.join(' '));
}

function init_heu(goal_state) {
	var goal_pos = new u8(SIZE);
	for(var i = 0; i < SIZE; i++) {
		goal_pos[goal_state[i]] = i;
	}

	return s => {
		var d = 0;
		for(var i = 0; i < SIZE; i++) {
			if (s[i] != 0)
				d += Math.abs(p2x[i]-p2x[goal_pos[s[i]]]) + Math.abs(p2y[i]-p2y[goal_pos[s[i]]])
		}
		return d;
	};
}

function parity(s) {
	var cnt = 0;
	for(let i = 1; i < SIZE; i++) {
		for(let j = 0; j < i; j++)
			if (s[j] < s[i])
				cnt++;
	}
	return cnt;
}

function is_out_bound(x, y) {
		return x < 0 || y < 0 || x >= N || y >= M;
}

function xy2p(x, y) {
	return y*N + x;
}

function swap(arr, i, j) {
	let c = arr[i];
	arr[i] = arr[j];
	arr[j] = c;
	return arr;
}

/* -------MAIN------- */

function A_star(start_state, goal_state) {

	/* initializaition */

	if (!(parity(start_state) ^ parity(goal_state) & 1)) {
		console.log('no solution');
		return;
	}

	const heu = init_heu(goal_state), goal_hash = hash(goal_state);

	let frontier = new PriorityQueue({
		comparator: (a, b) => a[0] - b[0]
	}), g = [], parent = [];

	frontier.queue([heu(start_state), start_state]);
	g[hash(start_state)] = 0;
	parent[hash(start_state)] = -1;

	/* A* search procedure */

	function *step() {
		while (frontier.length) {
			let cur = frontier.dequeue()[1], cur_hash = hash(cur);
			
			postMessage({
				msg: 'dequeue',
				hash: cur_hash
			})

			if (cur_hash == goal_hash) {
					break;
				}

			let x, y, p;
			for(let i = 0; i < SIZE; i++)
				if (cur[i] == 0) {
					x = p2x[i]; y = p2y[i]; p = i; break;
				}

			for (let d of [[1,0], [-1,0], [0, -1], [0, 1]]) {
				let nx = x + d[0], ny = y + d[1], np = xy2p(nx,ny);

				if (is_out_bound(nx, ny)) {
					continue;
				}

				let ns = swap(cur.slice(), np, p), 
						ns_hash = hash(ns),
						ng = g[cur_hash] + 1;
				
				/* generation return of search edge */

				if ( g[ns_hash] === undefined || ng < g[ns_hash] ) {
					yield {
							from: cur_hash,
							to: ns_hash,
							g_from: ng-1,
							g_to: ng,
							state_from: cur,
							state_to: ns,
							h_from: heu(cur),
							h_to: heu(ns)
						};
					g[ns_hash] = ng;
					frontier.queue([ng + heu(ns), ns]);
					parent[ns_hash] = cur_hash;
				}
			}
		}
	}

	/* session functions */

	var it = step();
	return {
		step: function() {
			var res = it.next();
			if (res.done) {
				return {
					msg: 'done'
				}
			}
			else {
				return Object.assign({ msg: 'step'}, res.value );
			}
		},
		get_solution: function() {
			var path = [], i = goal_hash;
			while(i != -1) {
				path.unshift(i);
				i = parent[i];
			}
			return {
				msg: 'solution',
				path: path.slice()
			}
		}
	};
}

var session;
onmessage = function(e) {
	/* onmessage e.data -->
	{
		msg: 'start',
		start_state: [5, 6, 3, 1, 4, 2, 8, 7, 0],
		goal_state: [0, 1, 2, 3, 4, 5, 6, 7, 8]
	}

	postMessage --> 
	{
		msg: 'done'
	}
	{
		msg: 'step',
		from: from_hash,
		to: to_hash,
		g: g of *to* state
	}
	{
		msg: 'solution',
		nodes: [ ..solution_nodes_hash.. ]
	}
	*/

	if (e.data.msg === 'start') {
		console.log('start');
		session = A_star(new u8(e.data.start_state), new u8(e.data.goal_state));
		console.log(session);
		postMessage({ 
			msg: 'start', 
			start: hash(e.data.start_state), 
			goal: hash(e.data.goal_state)
		});
	}
	else if(e.data.msg === 'step') {
		console.log(session);
		postMessage(session.step());
	}
	else if(e.data.msg === 'get_solution') {
		postMessage(session.get_solution());
	}
}