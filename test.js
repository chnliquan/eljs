/* eslint-disable @typescript-eslint/explicit-member-accessibility */
class Base {
  opts = {}
  constructor(opts) {
    this.opts = opts
  }
}

class X extends Base {
  opts

  constructor(opts) {
    super(opts)
  }

  run() {
    console.log(this.opts)
  }
}

new X({
  a: 1,
}).run()
