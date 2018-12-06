const AWS   = require('aws-sdk');
const Sharp = require('sharp');
const probe = require('probe-image-size');
const mime  = require('mime-types');
const ops   = require('./transformations');

const filenameRe  = new RegExp('(color|gray|bitonal|default)\.(jpg|tif|gif|png)');
const tiffBucket  = process.env.tiff_bucket;

let IIIF = class {
  constructor(url) {
    var segments = url.split('/');
    this.filename = segments.pop();
    if (this.filename.match(filenameRe)) {
      this.rotation   = segments.pop();
      this.size       = segments.pop();
      this.region     = segments.pop();
      this.quality    = RegExp.$1;
      this.format     = RegExp.$2;
    } else if (this.filename != 'info.json') {
      throw `Invalid IIIF URL: ${url}`;
    }
    this.id = decodeURIComponent(segments.pop());
    this.baseUrl = segments.join('/');
  }

  s3Object() {
    var s3 = new AWS.S3();
    return s3.getObject({ 
      Bucket: tiffBucket, 
      Key: `${this.id}-pyramid.tif`, 
    }).createReadStream();
  }
  
  dimensions() {
    if (this.sizeInfo == null) {
      this.sizeInfo = probe(this.s3Object()).then(data => this.sizeInfo = data);
    }
    return this.sizeInfo;
  }

  infoSizes(width, height, stack = []) {
    stack.push({ width, height });
    if (width > 100 || height > 100) {
      return this.infoSizes(Math.floor(width / 2), Math.floor(height / 2), stack);
    } else {
      return stack;
    }
  }
  
  async infoJson() {
    var doc = require('./info.json');
    var dimensions = await this.dimensions();

    doc['@id'] = [this.baseUrl, encodeURIComponent(this.id)].join('/');
    doc.width = dimensions.width;
    doc.height = dimensions.height;
    doc.sizes = this.infoSizes(dimensions.width, dimensions.height);
    doc.profile[1].formats = ops.formats;
    doc.profile[1].qualities = ops.qualities;
    for (var i in doc.sizes) {
      doc.tiles[0].scaleFactors.push(2**i);
    }
    return { contentType: 'application/json', body: JSON.stringify(doc) };
  }
  
  async iiifImage() {
    var dimensions = await this.dimensions();
    var result = await this.s3Object(this.id)
      .pipe(Sharp().rotate())
      .pipe(ops.region(this.region, dimensions))
      .pipe(ops.size(this.size, dimensions))
      .pipe(ops.rotation(this.rotation))
      .pipe(ops.quality(this.quality))
      .pipe(ops.format(this.format))
      .toBuffer();
    return { contentType: mime.lookup(this.format), body: result };
  }
  
  async execute() {
    if (this.filename == 'info.json') {
      return this.infoJson();
    } else {
      return this.iiifImage();
    }
  }
}

module.exports = IIIF;