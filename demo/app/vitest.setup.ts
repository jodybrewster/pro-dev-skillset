// happy-dom has no IntersectionObserver; Reveal uses it. Stub it so component
// renders don't throw (and immediately "intersect" so content is visible).
class IO {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
