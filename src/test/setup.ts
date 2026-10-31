import '@testing-library/jest-dom/vitest';

// jsdom has no canvas; report "no WebGL/2D" quietly instead of logging "not implemented".
HTMLCanvasElement.prototype.getContext = () => null;
