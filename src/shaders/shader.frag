precision highp float;

varying vec3 fNormal;
varying vec3 fColor;

void main() {
	vec3 color = fColor;

	if ((fNormal.z + fNormal.y) < 0.0) {
		color = color * 0.8;
	}

	if ((fNormal.z + fNormal.x) < 0.0) {
		color = color * 0.9; 
	}

	gl_FragColor = vec4(color, 1.0);
}
