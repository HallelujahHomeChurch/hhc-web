// T0 browser feasibility only; T5 uses the verified private export snapshot.
export async function wordPrototype() {
  const {Document,Packer,Paragraph,TextRun}=await import('docx');
  const paragraphs=[];
  for(const [quote,note] of [['內容0。','讓閱讀保持專注，工具在需要的時候出現。\n引用與自己的筆記分開呈現。'],['長引用包含中文、日文の文章、한국어、emoji 😀 與 <XML & 特殊字元>。'.repeat(14),'這則較長的筆記會自然換頁，保留換行。\n'.repeat(25)]]){
    for(const line of quote.split('\n'))paragraphs.push(new Paragraph({children:[new TextRun(line)],indent:{left:360,right:360},shading:{fill:'F3F4F6'},spacing:{before:160,after:120,line:360}}));
    for(const line of note.split('\n'))paragraphs.push(new Paragraph({children:[new TextRun(line)],spacing:{after:160,line:360},widowControl:true}));
    paragraphs.push(new Paragraph({text:'',spacing:{after:240}}));
  }
  return Packer.toBlob(new Document({creator:'',lastModifiedBy:'',title:'',description:'',styles:{default:{document:{run:{font:{ascii:'Arial Unicode MS',hAnsi:'Arial Unicode MS',eastAsia:'Arial Unicode MS',cs:'Arial Unicode MS'},size:24},paragraph:{spacing:{line:360}}}}},sections:[{properties:{page:{margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:paragraphs}]}));
}
