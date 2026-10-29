export function total(numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}

export function average(numbers) {
  return numbers.length === 0 ? 0 : total(numbers) / numbers.length;
}
