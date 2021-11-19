import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec3 } from "../../libs/MV.js";
import { modelView, loadMatrix, multMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation } from "../../libs/stack.js";

import * as SPHERE from '../../libs/sphere.js';
import * as CUBE from '../../libs/cube.js';

/** @type WebGLRenderingContext */
let gl;

/* Matrices */
let mProjection;
let mView;

let time = 0;           // Global simulation time in days
let speed = 1 / 60;         // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const edge = 2.0;

function eventListeners() {

}

function setup(shaders) {
	let canvas = document.getElementById("gl-canvas");
	let aspect = canvas.width / canvas.height;

	gl = setupWebGL(canvas);

	let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

	//let mProjection = ortho(- VP_DISTANCE * aspect, VP_DISTANCE * aspect, - VP_DISTANCE, VP_DISTANCE, - 3 * VP_DISTANCE, 3 * VP_DISTANCE);

	mode = gl.LINES; 

	resize_canvas();
	window.addEventListener("resize", resize_canvas);

	document.onkeydown = function(event) {
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

		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		SPHERE.init(gl);
		gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
		
		window.requestAnimationFrame(render);

	function resize_canvas(event) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		aspect = canvas.width / canvas.height;

		gl.viewport(0,0,canvas.width, canvas.height);
		//mProjection = ortho(- VP_DISTANCE * aspect, VP_DISTANCE * aspect, - VP_DISTANCE, VP_DISTANCE, - 3 * VP_DISTANCE, 3 * VP_DISTANCE);
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

	/*
	function Sun() {
		// Don't forget to scale the sun, rotate it around the y axis at the correct speed
		// ..
		multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);
		multRotationY((360 * time) / SUN_DAY);

		// Send the current modelview matrix to the vertex shader
		uploadModelView();

		// Draw a sphere representing the sun
		SPHERE.draw(gl, program, mode);
	}

	function Mercury() { 
		multScale([MERCURY_DIAMETER, MERCURY_DIAMETER, MERCURY_DIAMETER]);
		multRotationY((360 * time) / MERCURY_DAY);

		// Send the current modelview matrix to the vertex shader
		uploadModelView();

		// Draw a sphere representing the sun
		SPHERE.draw(gl, program, mode);
	}

	function Venus() {
		multScale([VENUS_DIAMETER, VENUS_DIAMETER, VENUS_DIAMETER]);
		multRotationY((360 * time) / VENUS_DAY);

		uploadModelView();

		SPHERE.draw(gl, program, mode);
	}

	function Earth() {
		multScale([EARTH_DIAMETER, EARTH_DIAMETER, EARTH_DIAMETER]);
		multRotationY((360 * time) / EARTH_DAY);

		uploadModelView();

		SPHERE.draw(gl, program, mode);
	}

	function Moon() {
		multScale([MOON_DIAMETER, MOON_DIAMETER, MOON_DIAMETER]);

		uploadModelView();

		SPHERE.draw(gl, program, mode);
	}

	function EarthAndMoon() {
		pushMatrix();
			Earth();
		popMatrix();

		pushMatrix();
			multRotationY([360 * time / MOON_YEAR])
			multTranslation([MOON_ORBIT * 60, 0, 0])
			Moon();
		popMatrix()
	}
	*/

	function drawTile(posX, posY) {
		multScale([1, 1, 1])
		multRotationY(0)
		
		uploadModelView();

		CUBE.draw(gl, program, mode);
	}
	
	function drawTileSet() {
		
	}

	function render() {
		if (animation) time += speed;
		window.requestAnimationFrame(render);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				
		gl.useProgram(program);
			
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
		
		mView = lookAt(vec3(0, 0, 0), vec3(-1, -1, -2), vec3(0, 1, 0));
		setupProjection();
		
		loadMatrix(mView);


		//loadMatrix(lookAt(vec3(0, 0, 0), vec3(-1, -1, -2), vec3(0, 1, 0)));

		drawTile(0, 0)

		/*
		pushMatrix();
			Sun();
		popMatrix();
		pushMatrix();
			multRotationY([360 * time / MERCURY_YEAR]);
			multTranslation([MERCURY_ORBIT, 0, 0]);
			Mercury();
		popMatrix();
		pushMatrix();
			multRotationY([360 * time / VENUS_YEAR]);
			multTranslation([VENUS_ORBIT, 0, 0]);
			Venus();
		popMatrix();
			
		pushMatrix();
			multRotationY([360 * time / EARTH_YEAR]);
			multTranslation([EARTH_ORBIT, 0, 0])
			EarthAndMoon();
		popMatrix();
		*/
	}
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))