uniform mat4 mModelView;
uniform mat4 mProjection;

attribute vec4 vPosition;
attribute vec3 vNormal;

//uniform bool uWireframe;
uniform vec3 uColor;

varying vec3 fColor;
varying vec3 fNormal;

void main() {
    gl_Position = mProjection * mModelView * vPosition;
    fNormal = vNormal;
    vec3 x = vNormal;
    fColor = uColor;
}
