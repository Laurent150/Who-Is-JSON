// Improve small screenshot legibility without changing its geometry or inventing characters.
async function prepareOcrImage(source){
    const img=new Image();img.src=source;await img.decode();
    if(img.naturalWidth*img.naturalHeight>16000000)throw Error('截图太大，请只保留要识别的代码区域。');
    const scale=Math.min(3,2400/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
    const corners=[0,(canvas.width-1)*4,(canvas.height-1)*canvas.width*4,(canvas.width*canvas.height-1)*4];
    const background=corners.reduce((sum,i)=>sum+.299*d[i]+.587*d[i+1]+.114*d[i+2],0)/4;
    const dark=background<128,threshold=dark?Math.round((255-background)*200/255):200;
    for(let i=0;i<d.length;i+=4){const gray=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]),ink=dark?255-gray:gray;d[i]=d[i+1]=d[i+2]=ink<threshold?0:255;}
    ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}
