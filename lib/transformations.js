const stream = require('stream');
const Sharp  = require('sharp');

const formats    = ["jpg", "tif", "gif", "png"];
const qualities  = ["color", "gray", "bitonal", "default"]
const Validators = {
  quality: '^(' + qualities.join('|') + ')$',
  format: '^(' + formats.join('|') + ')$',
  region: '^(full|square|(?:pct:)?\\d+,\\d+,\\d+,\\d+)$',
  size: '^(full|max|pct:\\d+|\\d+,|,\\d+|\\!?\\d+,\\d+)$',
  rotation: '^(\\!?\\d+)$'
}

function validate(type, v) {
  var re = new RegExp(Validators[type]);
  if (!re.test(v)) { 
    throw `Invalid ${type}: ${v}`;
  }
  return true;
}

function passThrough() {
  return new stream.PassThrough();
}

function regionSquare(dims) {
  if (dims.width == dims.height) {
    return new stream.PassThrough();
  } else {
    var side = Math.min(dims.width, dims.height);
    var params = { width: side, height: side };
    var offset = Math.abs(Math.floor((dims.width - dims.height) / 2));
    if (dims.width > dims.height) {
      params.left = offset;
      params.top  = 0;
    } else {
      params.left = 0;
      params.top  = offset;
    }
    return Sharp().extract(params);
  }
}

function regionPct(v, dims) {
  [x, y, w, h] = v.split(/\s*,\s*/).map(pct => { return (Number(pct) / 100.0) });
  [x, w] = [x, w].map(val => Math.round(dims.width * val) );
  [y, h] = [y, h].map(val => Math.round(dims.height * val) );
  return regionXYWH([x, y, w, h])
}

function regionXYWH(v) {
  if (typeof v == 'string') {
    v = v.split(/\s*,\s*/).map(val => Number(val));
  }
  return Sharp().extract({ left: v[0], top: v[1], width: v[2], height: v[3] });
}

function sizePct(v, dims) {
  var pct = Number(v);
  if (isNaN(pct) || pct <= 0) {
    throw `Invalid resize %: ${v}`;
  }
  var width = Math.round(dims.width * (pct / 100.0));
  return sizeWH(`${width},`)
}

function sizeWH(v) {
  var params = { fit: 'inside' };
  if (typeof v == 'string') {
    if (v[0] == '!') {
      params.fit = 'fill';
    }
    v = v.replace(/^!/,'').split(/\s*,\s*/).map(val => val == '' ? null : Number(val));
  }
  [params.width, params.height] = v;
  if (params.width == 0 || params.height == 0) {
    throw `Resize width and height must both be > 0`;
  }
  return Sharp().resize(params);
}

module.exports = {
  region: (v, dims) => { 
    validate('region', v);

    if (v == 'full') {
      return passThrough();
    } else if (v == 'square') {
      return regionSquare(dims);
    } else if (v.match(/^pct:([\d,]+)/)) {
      return regionPct(RegExp.$1, dims);
    } else {
      return regionXYWH(v);
    }
  },
  
  size: (v, dims) => {
    validate('size', v);

    if (v == 'full' || v == 'max') {
      return passThrough();
    } else if (v.match(/^pct:([\d]+)/)) {
      return sizePct(RegExp.$1, dims);
    } else {
      return sizeWH(v);
    }
  },
  
  rotation: (v) => {
    validate('rotation', v);

    if (v == '0') {
      return passThrough();
    }
  
    var transformer = Sharp();
    if (v[0] == '!') {
      transformer = transformer.flip();
    }
    var value = Number(v.replace(/^!/, ''));
    if (isNaN(value)) {
      throw `Invalid rotation value: ${v}`;
    }
    return transformer.rotate(value);
  },
  
  quality: (v) => {
    validate('quality', v);
    if (v == 'color' || v == 'default') {
      return passThrough();
    } else if (v == 'gray') {
      return Sharp().grayscale();
    } else if (v == 'bitonal') {
      return Sharp().threshold();
    }
  },
  
  format: (v) => {
    validate('format', v);
    return Sharp().toFormat(v);
  },

  qualities: qualities,
  
  formats: formats
}
