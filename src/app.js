import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, vec3 } from "../libs/MV.js";
import { modelView, loadMatrix, multMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation, multRotationX, multRotationZ } from "../libs/stack.js";

import * as SPHERE from '../libs/sphere.js';
import * as CUBE from '../libs/cube.js';
import * as TORUS from '../libs/torus.js';
import * as CYLINDER from '../libs/cylinder.js';

/** @type WebGLRenderingContext */
let gl;

/* Matrices */
let mProjection;
let mView;

let VP_DISTANCE = 10;

/* GLSL */
let uColor;

/* Global Vars */
let time = 0;           // Global simulation time in days
let speed = 1 / 60;         // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

let tankPosition = [0.0, 0.0, 0.0]

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
			case 'ArrowUp':
				tankPosition[0] -= 0.05;
				break;
			case 'ArrowDown':
				tankPosition[0] += 0.05;
				break;
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
				VP_DISTANCE -= 0.5;
				resize_canvas();
				break;
			case '-':
				VP_DISTANCE += 0.5;
				resize_canvas();
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
	TORUS.init(gl);
	CYLINDER.init(gl);

	gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
	
	window.requestAnimationFrame(render);

	function resize_canvas(event) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		aspect = canvas.width / canvas.height;

		gl.viewport(0, 0, canvas.width, canvas.height);

		//mView = lookAt(vec3(1, 1, 1), vec3(-1, -1, -2), vec3(0, 1, 0));
		mView = lookAt(vec3(1, 1, 1), vec3(0, 0, 0), vec3(0, 1, 0));
		mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);
	}

	function uploadModelView() {
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
	}

	// Tank Drawing
	
	function drawTank(posX, posY, posZ) {
		drawFrame(posX, posY, posZ);
	}

	function drawFrame(posX, posY, posZ) {
		pushMatrix();
			drawWheelSet(posX, posY, posZ)
		popMatrix();
		pushMatrix();
			drawWheelSet(posX + 1.5, posY, posZ);
		popMatrix();
		pushMatrix();
			drawWheelSet(posX + 3.5, posY, posZ)
		popMatrix();
		pushMatrix();
			drawWheelSet(posX + 5.0, posY, posZ);
		popMatrix();
	}

	function drawWheelSet(posX, posY, posZ) {
		pushMatrix();
			drawWheel(posX, posY, posZ);
		popMatrix();
		pushMatrix();
			drawAxis(posX, posY, posZ);
		popMatrix();
			drawWheel(posX, posY, posZ + 4.0);
		popMatrix();
	}
	
	function drawWheel(posX, posY, posZ) {
		multTranslation([posX, posY + 0.7, posZ]);
		multRotationX(90.0);
		multRotationY(0.0);
		multRotationZ(0.0);
		multScale([1.0, 1.0, 1.0]);
		
		uploadModelView();

		gl.uniform3fv(uColor, flatten(vec3(0.180, 0.203, 0.250)));
		TORUS.draw(gl, program, mode);
	}

	function drawAxis(posX, posY, posZ) {
		multTranslation([posX, 0.7, 2.0]);
		multRotationX(90.0);
		multRotationY(0.0);
		multRotationZ(0.0);

		multScale([0.25, 4.0, 0.25]);

		uploadModelView();

		//gl.uniform3fv(uColor, flatten(vec3(0.298, 0.337, 0.415)));
		gl.uniform3fv(uColor, flatten(vec3(1.0, 0.0, 0.0)));
		CYLINDER.draw(gl, program, mode);
	}

	// Tileset Drawing

	function drawTile(posX, posY, posZ) {
		multTranslation([posX, posY, posZ]);
		multScale([1.0, 0.1, 1.0]);
		
		uploadModelView();

		CUBE.draw(gl, program, mode);
	}
	
	function drawTileSet() {
		for (let i = -15; i < 15; i++) {
			for (let j = -15; j < 15; j++) {
				pushMatrix()
					if ((i % 2 == 0) ? (j % 2 == 0) : (j % 2 != 0)) {
						gl.uniform3fv(uColor, flatten(vec3(0.639, 0.745, 0.549)))
					} else {
						gl.uniform3fv(uColor, flatten(vec3(0.368, 0.505, 0.674)))
					}
					
					drawTile(i, -0.05, j)
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

		drawTileSet();
		drawTank(tankPosition[0], tankPosition[1], tankPosition[2]);

	}
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
