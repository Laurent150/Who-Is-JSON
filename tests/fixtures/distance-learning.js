// Regression example for the reported syntax; not a copy of the unseen segDist file.
function distanceBetween(a, b) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  return Math.hypot(x2 - x1, y2 - y1);
}

function readProduct(product) {
  const [price, stock] = product;
  return {price, stock};
}
