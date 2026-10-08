export function accessKey(number=1) {
 const body="35"+"2610"+"12345678000195"+"55"+"001"+String(number).padStart(9,"0")+"1"+"12345678";
 let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(body[i])*w;w=w===9?2:w+1;}
 const r=sum%11;return body+(r<2?0:11-r);
}
export function invoiceXml(number=1){const key=accessKey(number);return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}" versao="4.00"><ide><mod>55</mod><nNF>${number}</nNF><serie>001</serie><dhEmi>2026-10-08T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000195</CNPJ><xNome>Distribuidora Fiscal Fictícia</xNome></emit><det nItem="1"><prod><cProd>CARNE-01</cProd><cEAN>SEM GTIN</cEAN><xProd>CARNE PATINHO KG</xProd><NCM>02013000</NCM><CFOP>5102</CFOP><uCom>KG</uCom><qCom>10.0000</qCom><vUnCom>31.9000000000</vUnCom><vProd>319.00</vProd><vDesc>9.00</vDesc></prod></det><total><ICMSTot><vProd>319.00</vProd><vDesc>9.00</vDesc><vFrete>10.00</vFrete><vNF>320.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;}
