import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, vec3, vec4, inverse, mult } from "../libs/MV.js";
import { modelView, loadMatrix, multRotationY, multScale, pushMatrix, popMatrix, multTranslation, multRotationX, multRotationZ } from "../libs/stack.js";

import * as SPHERE from '../libs/sphere.js';
import * as CUBE from '../libs/cube.js';
import * as TORUS from '../libs/torus.js';
import * as CYLINDER from '../libs/cylinder.js';
import * as PYRAMID from '../libs/pyramid.js';
import * as PRISM from '../libs/triangular_prism.js';

/** @type WebGLRenderingContext */
let gl;

/* Matrices */
let mProjection;
let mView;

let mWheels;
let mBarrel;

let VP_DISTANCE = 10;

/* GLSL */
let uColor;

/* Global Vars */
let time = 0;           // Global simulation time in days
let speed = 1 / 60;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

// Tank metrics
let tankPosition = [0.0, 0.0, 0.0]
let turretAngle = 0.0;
let barrelAngle = 0.0;

// Shell metrics
let shells = []; // Array of vec3 tuples, (position, speed).
const SHELL_SPEED = 30.0 * speed;

/* Shader Programs */
let program;

const edge = 2.0;

//Colors
const TILE_COLOR_1 = vec3(0.639, 0.745, 0.549);
const TILE_COLOR_2 = vec3(0.368, 0.505, 0.674);
const WHEEL_COLOR = vec3(0.180, 0.203, 0.250);
const HUBCAP_COLOR = vec3(0.109, 0.132, 0.179);
const WHEEL_AXLE_COLOR = vec3(0.148, 0.148, 0.148);
const MAIN_AXLE_COLOR = vec3(0.148, 0.148, 0.148);
const MAIN_ARMOR_COLOR = vec3(0.254,0.325,0.231);
const MAIN_ARMOR_COLOR_2 = vec3(0.154,0.225,0.131);

//Characteristics
const TANK_HEIGHT = 2.0;
const TANK_LENGTH = 8.0;
const TANK_WIDTH = 4.0;
const BODY_CLEARANCE = 0.85;

const WHEEL_RADIUS = 0.7;
const GROUPS_OF = 2;
const MIN_DIST = 1.45;

const TURRET_ROT_SPEED = 2.0;
const BARREL_ELV_SPEED = 2.0;
const MIN_DEPRESSION = 0.0;
const MAX_ELEVATION = 18.0;

const BODY_LENGTH = TANK_LENGTH - 0.5;
const BODY_WIDTH = TANK_WIDTH - 0.8;

// Shell characteristics

//Physics
const TANK_ACCELERATION = 0.01;
const MAX_SPEED = 2;

const FRICTION_COEF = 0.95;
const EARTH_ACCELERATION = 9.8; //m.s^2

const RAD = (2 * Math.PI)/360


let tankSpeed = 0;
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

	mView = lookAt(vec3(1, 1, 1), vec3(0, 0, 0), vec3(0, 1, 0));

	window.addEventListener("resize", resize_canvas);

	document.onkeydown = (event) => {
		switch (event.key) {
			case 'ArrowUp':
				if (tankSpeed <= MAX_SPEED)
					tankSpeed += TANK_ACCELERATION+(tankSpeed*0.1);
				break;
			case 'ArrowDown':
				if (Math.abs(tankSpeed) <= MAX_SPEED)
					tankSpeed -= TANK_ACCELERATION+(tankSpeed*0.05);
				break;
			case 'w':
				if (barrelAngle < MAX_ELEVATION)
					barrelAngle += TURRET_ROT_SPEED;
				break;
			case 's':
				if (barrelAngle > -MIN_DEPRESSION)
					barrelAngle -= TURRET_ROT_SPEED;
				break;
			case 'a':
				turretAngle += BARREL_ELV_SPEED;
				break;
			case 'd':
				turretAngle -= BARREL_ELV_SPEED;
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
			case ' ':
				addShell();
				break;
			case '+':
				VP_DISTANCE -= 0.5;
				resize_canvas();
				break;
			case '-':
				VP_DISTANCE += 0.5;
				resize_canvas();
				break;
			case 'Backspace':
				tankPosition[0] = 0;
				tankSpeed = 0;
				turretAngle = 0;
				barrelAngle = 0;
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
				mView = lookAt(vec3(1, 1, 1), vec3(0, 0, 0), vec3(0, 1, 0));
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
	PRISM.init(gl);

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
			
			drawFrame();

			pushMatrix();
				drawArmour();
			popMatrix();
			
			pushMatrix();
				drawTurret();
			popMatrix();
		popMatrix();
	}

	function drawFrame() {
		// Draws wheels and axles using the grouped method, also possible through individual addition.
		pushMatrix();
			drawWheelGroup(0.5);
			drawWheelGroup(1);
		popMatrix();
	
		pushMatrix();
			drawDrivingAxle();
		popMatrix();
	}


	//=========================================================================
	function drawTurret() {
		multTranslation([TANK_LENGTH / 2 + 2, TANK_HEIGHT, TANK_WIDTH / 2]);
		multScale([0.9, 0.9, 0.9])

		pushMatrix();
			multTranslation([0.0, -0.2, 0.0])

			pushMatrix();
				multScale([2.7, 0.1, 2.7]);

				gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR))
				uploadModelView();

				CYLINDER.draw(gl, program, mode);
			popMatrix();

			//
			multTranslation([-BODY_LENGTH/2, 0.0, 0.0]);

			pushMatrix();
				multTranslation([0.0, 0.0, 0.8])
				multScale([3, 0.1, 1.4]);

				gl.uniform3fv(uColor, flatten(vec3(0.25, 0.25, 0.25)))
				uploadModelView();

				CUBE.draw(gl, program, mode);
			popMatrix();

			pushMatrix();
				multTranslation([0.0, 0.0, -0.8])
				multScale([3, 0.1, 1.4]);

				gl.uniform3fv(uColor, flatten(vec3(0.25, 0.25, 0.25)))
				uploadModelView();

				CUBE.draw(gl, program, mode);
			popMatrix();
		popMatrix();

		multRotationY(turretAngle);

		pushMatrix();
			drawTurretHull();
		popMatrix();

		pushMatrix();
			drawBarrel();
		popMatrix();
	}

	function drawTurretHull() {
		multScale([2, 1, 2]);

		gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR))
		uploadModelView();

		CYLINDER.draw(gl, program, mode);

		multTranslation([0.0, 0.3, 0.0])
		gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2))
		uploadModelView();

		SPHERE.draw(gl, program, mode);
	}

	function drawBarrel() {
		multRotationZ(90.0 + barrelAngle);

		pushMatrix()
			multTranslation([0, -2, 0])
			
			multScale([0.25, TANK_LENGTH + 2.5, 0.25]);

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2))
			uploadModelView();

			TORUS.draw(gl, program, mode);
		popMatrix()

		pushMatrix();
			multTranslation([0, -4, 0])

			multScale([0.30, 2.5, 0.30 ]);

			gl.uniform3fv(uColor, flatten(vec3(0.184, 0.235, 0.164)))
			uploadModelView();

			TORUS.draw(gl, program, mode);

			pushMatrix();
				mBarrel = modelView();
			popMatrix();
		popMatrix();
	}


	//=========================================================================
	// Armour
	function drawArmour() {
		multTranslation([TANK_LENGTH/2 + 0.5, 0.0, 0.0]);

		pushMatrix();
			drawMainBody();
		popMatrix();

		drawSkirts();

		//Undecarriage
		pushMatrix();
			multTranslation([0, 0.4, TANK_WIDTH / 2])
			multScale([1.5, 1.0, TANK_WIDTH])
			multRotationZ(180)

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR));
			
			uploadModelView();

			PRISM.draw(gl, program, mode);
		popMatrix();

		drawFront();
	}

	function drawMainBody() {
		multTranslation([0.0, BODY_CLEARANCE, 2.0])
			multScale([BODY_LENGTH, TANK_HEIGHT, BODY_WIDTH])

			uploadModelView();

			gl.uniform3fv(uColor, flatten(vec3(0.184, 0.235, 0.164)))
			CUBE.draw(gl, program, mode);
	}

	function drawSkirts() {
		// Skirts
		pushMatrix();
			multTranslation([0.0, 1.36, 0.25])

			multRotationY(90.0);
			multRotationZ(17.0);
			
			multScale([1.0, 1.0, BODY_LENGTH])

			uploadModelView();

			
			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2))
			PRISM.draw(gl, program, mode);
		popMatrix();

		pushMatrix();
			multTranslation([0.0, 1.36, 3.75]);

			multRotationY(90.0);
			multRotationZ(-17)

			multScale([1.0, 1.0,BODY_LENGTH])
			
			uploadModelView();

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2))
			PRISM.draw(gl, program, mode);
		popMatrix();

		//Frontal skirts
		pushMatrix();
			multTranslation([TANK_LENGTH/2 - 0.3, TANK_HEIGHT/2, BODY_WIDTH + 0.32])
		
			multRotationX(47);
			multRotationZ(45);

			multScale([1, 0.9, 1.1])

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2));
			
			uploadModelView();

			CUBE.draw(gl, program, mode);
		popMatrix();

		pushMatrix();
			multTranslation([TANK_LENGTH/2 - 0.3, TANK_HEIGHT/2 , 0.49])
			
			multRotationX(-47);
			multRotationZ(45);

			multScale([1, 0.9, 1.1])

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2));
			uploadModelView();
			CUBE.draw(gl, program, mode);
		popMatrix();
	}


	function drawFront() {
		// Front
		pushMatrix();
			multTranslation([TANK_LENGTH / 2 + 0.5, TANK_HEIGHT / 2 - 0.15, TANK_WIDTH / 2]);

			pushMatrix();
				multTranslation([-0.15, 0.48, -0.9]);

				drawViewHole();
			popMatrix();

			multScale([1.5, TANK_HEIGHT, BODY_WIDTH])
			multRotationZ(270.0)

			gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR));
			
			uploadModelView();

			PRISM.draw(gl, program, mode);
		popMatrix();
	}

	function drawViewHole() {
		pushMatrix();
			multTranslation([0.2, 0.13, 0.0]);

			multRotationZ(45)

			multScale([0.05, 0.27, 0.8])

			gl.uniform3fv(uColor, flatten(vec3(0.0, 0.0, 0.3)));

			uploadModelView();
			CUBE.draw(gl, program, mode);
		popMatrix();

		pushMatrix();
			multTranslation([0.3,0.1,1.5]);
			multRotationZ(-40.0);
			drawStaticWheel();
		popMatrix();

		multRotationZ(120)

		multScale([0.5, 0.5, 1.0])

		gl.uniform3fv(uColor, flatten(MAIN_ARMOR_COLOR_2));
		uploadModelView();
		PRISM.draw(gl, program, mode);
	}


	function drawDrivingAxle(middleOffset = 0) {
		multTranslation([TANK_LENGTH / 2 + 0.6, 0, TANK_WIDTH / 2 + middleOffset]);
		multRotationZ(90.0);
		multScale([0.3, TANK_LENGTH - 0.8, 0.3])

		gl.uniform3fv(uColor, flatten(MAIN_AXLE_COLOR));
		uploadModelView();

		CYLINDER.draw(gl, program, mode);
	}

	//=========================================================================
	// Wheel drawing

	let wheelAngle = 0;
	function drawWheelGroup(dist) {
		multTranslation([dist, 0, 0]);

		wheelAngle += -(tankSpeed/(WHEEL_RADIUS * 2 * Math.PI)) * 360

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
		multRotationY(wheelAngle);
		drawStaticWheel();
	}

	function drawStaticWheel() {
		multScale([1.0, 1.8, 1.0])
		
		//===================
		uploadModelView();
		gl.uniform3fv(uColor, flatten(WHEEL_COLOR));
		
		TORUS.draw(gl, program, mode);
		
		//===================
		multScale([0.7, 0.3, 0.7]);
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
	// Shell addition, animation, and simulation.

	/**
	 * Adds a new shell to the array.
	 */
	function addShell() {
		let wc = mult(inverse(mView), mBarrel);
		let position = mult(wc, vec4(0.0, 0.0, 0.0, 1.0))

		// If speed = 1, it will be distributed along the angles according to the trigonometric factor of each axle.
		let ySpeed = SHELL_SPEED * Math.sin(barrelAngle * RAD);
		let horizontalSpeed = SHELL_SPEED * Math.cos(barrelAngle * RAD); //Mathematically similar to 'SPEED * Math.cos(barrelAngle)'

		// Turret is originally aligned along the X axis, so, the reference shall be set at x+
		let xSpeed = horizontalSpeed * Math.cos(-(turretAngle % 360) * RAD);
		let zSpeed = horizontalSpeed * Math.sin(-(turretAngle % 360) * RAD); //Mathematically similar to 'SPEED * Math.cos(turretAngle)'
		
		let shellSpeed = vec3(xSpeed, ySpeed, zSpeed);

		let aux = {position: vec3(position[0], position[1], position[2]), speed: shellSpeed};
		shells.push(aux);
	}

	function drawShell(pos, vertSpeed) {
		multTranslation(pos);	
		multRotationZ(90 + barrelAngle - vertSpeed);
		multRotationX(turretAngle + 180);

		multScale([0.2, 0.4, 0.2]);

		gl.uniform3fv(uColor, flatten(vec3(1.0, 1.0, 0.0)));
		uploadModelView();
		PYRAMID.draw(gl, program, mode);
	}

	//=========================================================================
	//Physics simulations

	function simulate() {
		tankPosition[0] += tankSpeed;

		tankSpeed *= FRICTION_COEF;

		simulateShells();
	}

	function simulateShells() {
		let rem = []
		for (const i in shells) {
	
			let position = shells[i].position;
			let shellSpeed = shells[i].speed;

			if (Math.round(position[1]) == 0)
				rem.push(i);

			pushMatrix();
				drawShell(position, shellSpeed[1])
			popMatrix();

			for (const j in position) {
				position[j] += shellSpeed[j];
			}

			shells[i].position = position;
			shells[i].speed[1] -= EARTH_ACCELERATION * 1/600;
		}

		for (const i in rem)
			shells.splice(i,1);
	}6

	//=========================================================================

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
