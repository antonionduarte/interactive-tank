precision highp float;

varying vec3 fNormal;
varying vec3 fColor;

void main() {
	vec3 color = fColor;

	if ((fNormal.z + fNormal.y) < 0.0) {
		color = vec3(color.x * 0.8, color.y * 0.8, color.z * 0.8);
	}

	gl_FragColor = vec4(color, 1.0);
}
