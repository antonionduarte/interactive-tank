import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, vec3 } from "../libs/MV.js";
import { modelView, loadMatrix, multMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation } from "../libs/stack.js";

import * as SPHERE from '../libs/sphere.js';
import * as CUBE from '../libs/cube.js';

/** @type WebGLRenderingContext */
let gl;

/* Matrices */
let mProjection;
let mView;

/* GLSL */
let uColor;

/* Global Vars */
let time = 0;           // Global simulation time in days
let speed = 1 / 60;         // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

/* Shader Programs */
let program;

const edge = 2.0;

function eventListeners() {

}

function setup(shaders) {
	// Setup
	let canvas = document.getElementById("gl-canvas");
	let aspect = canvas.width / canvas.height;

	gl = setupWebGL(canvas);
	mode = gl.TRIANGLES; 

	// Build Programs
	program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

	// Event Listener Setup
	resize_canvas();
	window.addEventListener("resize", resize_canvas);

	document.onkeydown = (event) => {
		switch (event.key) {
			case 'w':
				mode = gl.LINES; 
				break;
			case 's':
				mode = gl.TRIANGLES;
				break;
			case 'p':
				animation = !animation;
				break; 
			case '+':
				if (animation) speed *= 1.1;
				break;
			case '-':
				if (animation) speed /= 1.1;
				break;
		}
	}

	// Attrib Locations
			
	// Uniform Locations
	uColor = gl.getUniformLocation(program, 'uColor')
		
	// WebGL
	
		

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	CUBE.init(gl);
	SPHERE.init(gl);

	gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
	
	window.requestAnimationFrame(render);

	function resize_canvas(event) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		aspect = canvas.width / canvas.height;

		gl.viewport(0,0,canvas.width, canvas.height);

		mView = lookAt(vec3(0, 0, 0), vec3(-1, -1, -2), vec3(0, 1, 0));
		setupProjection();
	}

	function setupProjection() {
		if (canvas.width < canvas.height) {
			const yLim = edge * canvas.height / canvas.width;
			mProjection = ortho(-edge, edge, -yLim, yLim, -10, 10);
		}
		else {
			const xLim = edge * canvas.width / canvas.height;
			mProjection = ortho(-xLim, xLim, -edge, edge, -10, 10);
		}
	}

	function uploadModelView() {
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
	}

	function drawTile(posX, posY, posZ) {
		multTranslation([posX, posY, posZ])
		multScale([1, 0.1, 1])
		multRotationY(0)
		
		uploadModelView();

		CUBE.draw(gl, program, mode);
	}
	
	function drawTileSet() {
		for (let i = -10; i < 10; i++) {
			for (let j = -10; j < 10; j++) {
				pushMatrix()
					if ((i % 2 == 0) ? (j % 2 == 0) : (j % 2 != 0)) {
						gl.uniform3fv(uColor, flatten(vec3(1.0, 0.0, 0.0)))
					} else {
						gl.uniform3fv(uColor, flatten(vec3(0.0, 1.0, 0.0)))
					}
					
					drawTile(i, 0, j)
				popMatrix()
			}
		}	
	}

	function render() {
		if (animation) time += speed;
		window.requestAnimationFrame(render);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				
		gl.useProgram(program);
			
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
		
		
		loadMatrix(mView);

		drawTileSet()
	}
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
