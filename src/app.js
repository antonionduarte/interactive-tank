import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, vec3 } from "../libs/MV.js";
import { modelView, loadMatrix, multMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation, multRotationX, multRotationZ } from "../libs/stack.js";

import * as SPHERE from '../libs/sphere.js';
import * as CUBE from '../libs/cube.js';
import * as TORUS from '../libs/torus.js';
import * as CYLINDER from '../libs/cylinder.js';
import * as PYRAMID from '../libs/pyramid.js';

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
let speed = 1 / 60;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

/*Tank metrics*/
let tankPosition = [0.0, 0.0, 0.0]
let turretAngle = 0.0;
let barrelAngle = 0.0;

/* Shader Programs */
let program;

const edge = 2.0;

//Colors
const TILE_COLOR_1 = vec3(0.639, 0.745, 0.549);
const TILE_COLOR_2 = vec3(0.368, 0.505, 0.674);
const WHEEL_COLOR = vec3(0.180, 0.203, 0.250);
const HUBCAP_COLOR = vec3(0.0, 1.0, 0.0);
const WHEEL_AXLE_COLOR = vec3(1.0, 0.0, 0.0);
const MAIN_AXLE_COLOR = vec3(0.0, 0.0, 1.0);
const MAIN_ARMOR_COLOR = vec3(0.254,0.325,0.231);
const MAIN_ARMOR_COLOR_2 = vec3(0.154,0.225,0.131);

//Characteristics
const TANK_LENGTH = 8.0;
const TANK_MASS = 12000;
const TANK_WIDTH = 4.0;
const MIN_DIST = 1.60;

const WHEEL_RADIUS = 0.7;
const GROUPS_OF = 2;

const MIN_DEPRESSION = 10.0
const MAX_ELEVATION = 30.0

//Physics
const ENGINE_OUTP = 1000;

const MAX_SPEED = 3;

const FRICTION_COEF = 0.4;
const EARTH_ACCELERATION = 9.8; //m.s^2


let objSpeed = 0;
//=========================================================================

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

	mView = lookAt(vec3(-1, 1, -1), vec3(0, 0, 0), vec3(0, 1, 0));

	window.addEventListener("resize", resize_canvas);

	document.onkeydown = (event) => {
		switch (event.key) {
			case 'ArrowUp':
				if(objSpeed <= MAX_SPEED)
					//TODO
				break;
			case 'ArrowDown':
				if (objSpeed <= MAX_SPEED)
					//TODO
				break;
			case 'w':
				if (barrelAngle < MAX_ELEVATION)
					barrelAngle += 2.0;
				break;
			case 's':
				if (barrelAngle > -MIN_DEPRESSION)
					barrelAngle -= 2.0
				break;
			case 'a':
				turretAngle -= 2.0;
				break;
			case 'd':
				turretAngle += 2.0;
				break;
			case 'W':
				mode = gl.LINES; 
				break;
			case 'S':
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
			case '1':
				mView = lookAt(vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 1, 0));
				break;
			case '2':
				mView = lookAt(vec3(0,1,0), vec3(0,-1,0), vec3(-1,0,0));
				break;
			case '3':
				mView = lookAt(vec3(0, 0, 1), vec3(0, 0, -1), vec3(0, 1, 0));
				break;
			case '4':
				mView = lookAt(vec3(-1, 1, -1), vec3(0, 0, 0), vec3(0, 1, 0));
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
	PYRAMID.init(gl);

	gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
	
	window.requestAnimationFrame(render);

	function resize_canvas(event) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		aspect = canvas.width / canvas.height;

		gl.viewport(0, 0, canvas.width, canvas.height);

		mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);
	}

	function uploadModelView() {
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
	}

	//=========================================================================
	// Tank Drawing
	
	function drawTank(posX, posY, posZ) {
		pushMatrix();
			multTranslation([posX - (TANK_LENGTH / 2), posY + WHEEL_RADIUS, posZ - (TANK_WIDTH / 2)]);
			//mTank = modelView();
			
			drawFrame();

			pushMatrix();
				drawArmour();
			popMatrix();

			drawTurret();
		popMatrix();
	}

	function drawFrame() {
		//Draws wheels and axles using the grouped method, also possible through individual addition.
		pushMatrix();
			drawWheelGroup(0.5);
			drawWheelGroup(1);
		popMatrix();
	
		pushMatrix();
			drawDrivingAxle();
		popMatrix();
	}

	function drawTurret() {
		multTranslation([TANK_LENGTH / 2, 2 ,TANK_WIDTH / 2]);
		multRotationY(180.0 + turretAngle);

		pushMatrix();
			drawTurretHull();
		popMatrix();

		pushMatrix();
			drawBarrel();
		popMatrix();
	}

	function drawTurretHull() {
		multScale([2, 2, 2]);

		gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR))
		uploadModelView();

		SPHERE.draw(gl, program, mode);
	}

	function drawBarrel() {
		multRotationZ(90.0 + barrelAngle);
		multTranslation([0, -2, 0])
		
		multScale([0.3, TANK_LENGTH, 0.3]);

		gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2))
		uploadModelView();

		TORUS.draw(gl, program, mode);
	}


	//=========================================================================
	//Armour

	function drawArmour() {
		pushMatrix();
			multTranslation([5.0, 1.95, 2.0])
			multScale([TANK_LENGTH, 2.35, TANK_WIDTH])

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR))

			uploadModelView();

			CUBE.draw(gl, program, mode);
		popMatrix();

		pushMatrix();

		popMatrix();
	}

	function drawDrivingAxle(middleOffset = 0) {
		multTranslation([TANK_LENGTH / 2 + 1, 0, TANK_WIDTH / 2 + middleOffset]);
		multRotationZ(90.0);
		multScale([0.3, TANK_LENGTH, 0.3])

		gl.uniform3fv(uColor, flatten(MAIN_AXLE_COLOR));
		uploadModelView();

		CYLINDER.draw(gl, program, mode);
	}

	//=========================================================================
	//Wheel drawing

	function drawWheelGroup(dist) {
		multTranslation([dist, 0, 0]);

		for (let x = 0; x < GROUPS_OF; x++) {
			drawWheelSet(MIN_DIST)
		}
	}

	function drawWheelSet(dist) {
		multTranslation([dist, 0, 0]);

		pushMatrix();
			drawWheel();
		popMatrix();

		pushMatrix();
			drawWheelAxle();
		popMatrix();

		pushMatrix();
			multTranslation([0, 0, TANK_WIDTH]);
			drawWheel();
		popMatrix();
	}

	function drawWheel() {
		multRotationX(90.0);
		
		//===================
		uploadModelView();
		gl.uniform3fv(uColor, flatten(WHEEL_COLOR));
		
		TORUS.draw(gl, program, mode);
		
		//===================
		multScale([0.5, 0.3, 0.5]);
		uploadModelView();
		gl.uniform3fv(uColor, flatten(HUBCAP_COLOR))

		CYLINDER.draw(gl, program, mode);
	}

	function drawWheelAxle() {
		multTranslation([0, 0, TANK_WIDTH / 2]);
		multRotationX(90.0);

		multScale([0.25, TANK_WIDTH , 0.25]);

		uploadModelView();

		gl.uniform3fv(uColor, flatten(WHEEL_AXLE_COLOR));
		CYLINDER.draw(gl, program, mode);
	}

	//=========================================================================
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
				pushMatrix();
					if ((i % 2 == 0) ? (j % 2 == 0) : (j % 2 != 0)) {
						gl.uniform3fv(uColor, flatten(TILE_COLOR_1));
					} else {
						gl.uniform3fv(uColor, flatten(TILE_COLOR_2));
					}
					
					drawTile(i, -0.05, j);
				popMatrix();
			}
		}	
	}

	//=========================================================================
	function simulate() {
		//TODO
	}

	function calcAcceleration(forces = [0]) {
		//TODO
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

		simulate();
	}
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
