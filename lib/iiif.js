const AWS        = require('aws-sdk');
const probe      = require('probe-image-size');
const mime       = require('mime-types');
const transform  = require('./transform');

const filenameRe  = new RegExp('(color|gray|bitonal|default)\.(jpg|tif|gif|png)');
const tiffBucket  = process.env.tiff_bucket;

class IIIF {
  constructor(url) {
    this.errorClass = transform.IIIFError;
    var segments = url.split('/');
    this.filename = segments.pop();
    if (this.filename.match(filenameRe)) {
      this.rotation   = segments.pop();
      this.size       = segments.pop();
      this.region     = segments.pop();
      this.quality    = RegExp.$1;
      this.format     = RegExp.$2;
    } else if (this.filename != 'info.json') {
      throw new this.errorClass(`Invalid IIIF URL: ${url}`);
    }
    this.id = decodeURIComponent(segments.pop());
    this.baseUrl = segments.join('/');
  }

  s3Object() {
    var s3 = new AWS.S3();
    var path = this.id.match(/.{1,2}/g).join('/');
    return s3.getObject({ 
      Bucket: tiffBucket, 
      Key: `${path}-pyramid.tif`, 
    }).createReadStream();
  }
  
  dimensions() {
    if (this.sizeInfo == null) {
      this.sizeInfo = probe(this.s3Object()).then(data => this.sizeInfo = data);
    }
    return this.sizeInfo;
  }

  async infoJson() {
    var dim = await this.dimensions();
    var sizes = [];
    for(var size = [dim.width, dim.height]; size.every(x => x >= 128); size = size.map(x => Math.floor(x/2))) {
      sizes.push({ width: size[0], height: size[1] });
    }

    var doc = {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": [this.baseUrl, encodeURIComponent(this.id)].join('/'),
      protocol: "http://iiif.io/api/image",
      width: dim.width,
      height: dim.height,
      sizes: sizes,
      tiles: [
        { 
          width: 512, 
          height: 512,
          scaleFactors: sizes.map((v, i) => 2**i)
        }
      ],
      profile: ["http://iiif.io/api/image/2/level2.json", {
        formats: transform.Formats,
        qualities: transform.Qualities,
        supports: ["regionByPx", "sizeByW", "sizeByWhListed", "cors", "regionSquare", "sizeByDistortedWh", "sizeAboveFull", "canonicalLinkHeader", "sizeByConfinedWh", "sizeByPct", "jsonldMediaType", "regionByPct", "rotationArbitrary", "sizeByH", "baseUriRedirect", "rotationBy90s", "profileLinkHeader", "sizeByForcedWh", "sizeByWh", "mirroring"]
      }]
    }

    return { contentType: 'application/json', body: JSON.stringify(doc) };
  }
  
  async iiifImage() {
    var dim = await this.dimensions();
    var ops = new transform.Operations(dim);
    var pipes = [
      ops.region(this.region),
      ops.size(this.size),
      ops.rotation(this.rotation),
      ops.quality(this.quality),
      ops.format(this.format)
    ]

    var transformer = pipes.reduce((state, next) => {
      if (next == null) {
        return state;
      }
      return state.pipe(next);
    }, this.s3Object(this.id));

    var result = await transformer.toBuffer();
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