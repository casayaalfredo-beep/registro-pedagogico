const pdf = require('pdf-parse');

const monthMap = {
  'ene': '01', 'enero': '01',
  'feb': '02', 'febrero': '02',
  'mar': '03', 'marzo': '03',
  'abr': '04', 'abril': '04',
  'may': '05', 'mayo': '05',
  'jun': '06', 'junio': '06',
  'jul': '07', 'julio': '07',
  'ago': '08', 'agosto': '08',
  'sep': '09', 'set': '09', 'septiembre': '09', 'setiembre': '09',
  'oct': '10', 'octubre': '10',
  'nov': '11', 'noviembre': '11',
  'dic': '12', 'diciembre': '12'
};

function parseSpanishDate(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\./g, '').trim().toLowerCase();
  const match = clean.match(/^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const mStr = match[2];
    const month = monthMap[mStr] || '01';
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function calculateAge(birthDateStr, referenceYear = 2026) {
  if (!birthDateStr) return null;
  const birthYear = parseInt(birthDateStr.split('-')[0]);
  if (isNaN(birthYear)) return null;
  return referenceYear - birthYear;
}

function parseSieName(fullName) {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  const rawParts = fullName.trim().split(/\s{2,}/);
  if (rawParts.length >= 2) {
    const primerApellido = rawParts[0].trim();
    const rest = rawParts.slice(1).join(' ').trim();
    const restWords = rest.split(/\s+/);
    if (restWords.length >= 2) {
      const segundoApellido = restWords[0];
      const nombres = restWords.slice(1).join(' ');
      return {
        apellidos: `${primerApellido} ${segundoApellido}`.trim(),
        nombres: nombres.trim()
      };
    } else {
      return {
        apellidos: primerApellido,
        nombres: rest
      };
    }
  }
  const words = clean.split(' ');
  if (words.length >= 3) {
    return {
      apellidos: words.slice(0, 2).join(' '),
      nombres: words.slice(2).join(' ')
    };
  } else if (words.length === 2) {
    return {
      apellidos: words[0],
      nombres: words[1]
    };
  }
  return { apellidos: clean, nombres: '' };
}

function cleanWord(w) {
  return (w || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function nameSimilarity(name1, name2) {
  const n1 = cleanWord(name1);
  const n2 = cleanWord(name2);
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.95;
  const dist = levenshtein(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return 1 - (dist / maxLen);
}

function tokenSimilarity(name1, name2) {
  const t1 = (name1 || '').toUpperCase().split(/\s+/).map(cleanWord).filter(Boolean);
  const t2 = (name2 || '').toUpperCase().split(/\s+/).map(cleanWord).filter(Boolean);
  let matches = 0;
  for (const w1 of t1) {
    if (t2.some(w2 => w1 === w2 || (w1.length > 3 && w2.length > 3 && levenshtein(w1, w2) <= 1))) {
      matches++;
    }
  }
  return matches / Math.max(t1.length, t2.length);
}

async function parseSiePdfBuffer(dataBuffer) {
  let allPagesItems = [];

  function render_page(pageData) {
    let render_options = { normalizeWhitespace: false, disableCombineTextItems: true };
    return pageData.getTextContent(render_options).then(function(textContent) {
      allPagesItems.push({
        pageIndex: pageData.pageIndex,
        items: textContent.items.map(it => ({
          str: it.str.trim(),
          x: it.transform[4],
          y: it.transform[5]
        })).filter(it => it.str !== '')
      });
      return '';
    });
  }

  await pdf(dataBuffer, { pagerender: render_page });

  let headerInfo = {
    sie: '',
    unidadEducativa: '',
    nivel: '',
    grado: '',
    paralelo: '',
    turno: '',
    gestion: ''
  };

  if (allPagesItems.length > 0) {
    const p1 = allPagesItems[0];
    const gestionItem = p1.items.find(it => it.str.includes('GESTION'));
    if (gestionItem) {
      const m = gestionItem.str.match(/GESTION\s*(\d{4})/i);
      if (m) headerInfo.gestion = m[1];
    }
    const sieLabel = p1.items.find(it => it.str.toUpperCase() === 'SIE:');
    if (sieLabel) {
      const sieVal = p1.items.find(it => Math.abs(it.y - sieLabel.y) < 3 && it.x > sieLabel.x);
      if (sieVal) headerInfo.sie = sieVal.str;
    }
    const ueLabel = p1.items.find(it => it.str.toUpperCase().includes('UNIDAD EDUCATIVA'));
    if (ueLabel) {
      const ueVal = p1.items.find(it => Math.abs(it.y - ueLabel.y) < 3 && it.x > ueLabel.x);
      if (ueVal) headerInfo.unidadEducativa = ueVal.str;
    }
    const nivLabel = p1.items.find(it => it.str.toUpperCase().includes('NIVEL'));
    if (nivLabel) {
      const nivVal = p1.items.find(it => Math.abs(it.y - nivLabel.y) < 3 && it.x > nivLabel.x);
      if (nivVal) headerInfo.nivel = nivVal.str;
    }
    const gradoLabel = p1.items.find(it => it.str.toUpperCase().includes('GRADO:'));
    if (gradoLabel) {
      const gradoVal = p1.items.find(it => Math.abs(it.y - gradoLabel.y) < 3 && it.x > gradoLabel.x);
      if (gradoVal) headerInfo.grado = gradoVal.str;
    }
    const parLabel = p1.items.find(it => it.str.toUpperCase().includes('PARALELO:'));
    if (parLabel) {
      const parVal = p1.items.find(it => Math.abs(it.y - parLabel.y) < 3 && it.x > parLabel.x);
      if (parVal) headerInfo.paralelo = parVal.str;
    }
    const turnoLabel = p1.items.find(it => it.str.toUpperCase().includes('TURNO:'));
    if (turnoLabel) {
      const turnoVal = p1.items.find(it => Math.abs(it.y - turnoLabel.y) < 3 && it.x > turnoLabel.x);
      if (turnoVal) headerInfo.turno = turnoVal.str;
    }
  }

  let students = [];
  const refYear = parseInt(headerInfo.gestion) || 2026;

  for (const page of allPagesItems) {
    const headerThreshold = page.items.find(it => it.str === 'Código Rude')?.y || 450;
    
    const rowAnchors = page.items.filter(it => 
      it.x >= 15 && it.x <= 38 && 
      /^\d+$/.test(it.str) && 
      it.y < (headerThreshold - 10) &&
      it.y > 50
    ).sort((a, b) => b.y - a.y);

    for (let i = 0; i < rowAnchors.length; i++) {
      const anchor = rowAnchors[i];
      const prevAnchorY = (i > 0) ? rowAnchors[i-1].y : (anchor.y + 18);
      const nextAnchorY = (i + 1 < rowAnchors.length) ? rowAnchors[i+1].y : (anchor.y - 18);

      const yTop = (anchor.y + prevAnchorY) / 2;
      const yBottom = (anchor.y + nextAnchorY) / 2;

      const rowItems = page.items.filter(it => 
        it.y <= yTop && it.y > yBottom && it.y > 55 &&
        !it.str.includes('---') && !it.str.includes('Sello') && !it.str.includes('Firma')
      );

      const no = anchor.str;
      const rudeItem = rowItems.find(it => it.x >= 39 && it.x <= 105);
      const ciItem = rowItems.find(it => it.x >= 106 && it.x <= 155);
      
      const nameItems = rowItems.filter(it => it.x >= 156 && it.x <= 270)
                               .sort((a, b) => b.y - a.y);
      const rawFullName = nameItems.map(it => it.str).join(' ');

      const generoItem = rowItems.find(it => it.x >= 271 && it.x <= 295);
      const fechaItem = rowItems.find(it => it.x >= 296 && it.x <= 385);
      
      const depItem = rowItems.find(it => it.x >= 456 && it.x <= 525);
      const provItem = rowItems.find(it => it.x >= 526 && it.x <= 605);
      const locItem = rowItems.find(it => it.x >= 606 && it.x <= 705);
      const matItem = rowItems.find(it => it.x >= 706);

      const fechaIso = parseSpanishDate(fechaItem ? fechaItem.str : '');
      const edad = calculateAge(fechaIso, refYear);

      const { apellidos, nombres } = parseSieName(rawFullName);

      let genero = '';
      if (generoItem) {
        const g = generoItem.str.toUpperCase();
        if (g === 'M') genero = 'MASCULINO';
        else if (g === 'F') genero = 'FEMENINO';
        else genero = g;
      }

      const lugarNac = [locItem?.str, provItem?.str, depItem?.str].filter(Boolean).join(', ');

      students.push({
        no: parseInt(no),
        rude: rudeItem ? rudeItem.str : '',
        ci: ciItem ? ciItem.str : '',
        fullName: `${apellidos} ${nombres}`.trim(),
        apellidos,
        nombres,
        genero,
        fechaNacimiento: fechaIso,
        edad,
        direccion: locItem ? locItem.str : (lugarNac || ''),
        lugarNacimiento: lugarNac,
        matricula: matItem ? matItem.str : '',
        padreMadre: '',
        telefono: ''
      });
    }
  }

  return { headerInfo, students };
}

function matchAndMergeStudents(pdfStudents, dbStudents) {
  let matchedDbIds = new Set();
  let results = [];

  for (const p of pdfStudents) {
    let bestCandidate = null;
    let bestScore = 0;

    // 1. Primary: Match by Name (full name similarity and token similarity)
    for (const d of dbStudents) {
      if (matchedDbIds.has(d.id)) continue;
      const dFull = `${d.apellidos} ${d.nombres}`;
      const tSim = tokenSimilarity(p.fullName, dFull);
      const nSim = nameSimilarity(p.fullName, dFull);
      const score = Math.max(tSim, nSim);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = d;
      }
    }

    // High confidence threshold for name similarity
    if (bestScore >= 0.55 && bestCandidate) {
      matchedDbIds.add(bestCandidate.id);
      results.push({
        action: 'UPDATE',
        existingId: bestCandidate.id,
        originalName: `${bestCandidate.apellidos} ${bestCandidate.nombres}`,
        data: {
          id: bestCandidate.id,
          apellidos: p.apellidos,
          nombres: p.nombres,
          rude: p.rude,
          ci: p.ci,
          genero: p.genero,
          fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : null,
          edad: p.edad,
          direccion: p.direccion || bestCandidate.direccion || '',
          padreMadre: bestCandidate.padreMadre || '',
          telefono: bestCandidate.telefono || ''
        }
      });
      continue;
    }

    // 2. Secondary fallback: Match by RUDE if both exist
    if (p.rude && p.rude.length > 6) {
      const rudeMatch = dbStudents.find(d => !matchedDbIds.has(d.id) && d.rude && d.rude.trim() === p.rude.trim());
      if (rudeMatch) {
        matchedDbIds.add(rudeMatch.id);
        results.push({
          action: 'UPDATE',
          existingId: rudeMatch.id,
          originalName: `${rudeMatch.apellidos} ${rudeMatch.nombres}`,
          data: {
            id: rudeMatch.id,
            apellidos: p.apellidos,
            nombres: p.nombres,
            rude: p.rude,
            ci: p.ci,
            genero: p.genero,
            fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : null,
            edad: p.edad,
            direccion: p.direccion || rudeMatch.direccion || '',
            padreMadre: rudeMatch.padreMadre || '',
            telefono: rudeMatch.telefono || ''
          }
        });
        continue;
      }
    }

    // 3. Third fallback: Match by CI if both exist
    if (p.ci && p.ci.length > 5) {
      const ciMatch = dbStudents.find(d => !matchedDbIds.has(d.id) && d.ci && d.ci.trim() === p.ci.trim());
      if (ciMatch) {
        matchedDbIds.add(ciMatch.id);
        results.push({
          action: 'UPDATE',
          existingId: ciMatch.id,
          originalName: `${ciMatch.apellidos} ${ciMatch.nombres}`,
          data: {
            id: ciMatch.id,
            apellidos: p.apellidos,
            nombres: p.nombres,
            rude: p.rude,
            ci: p.ci,
            genero: p.genero,
            fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : null,
            edad: p.edad,
            direccion: p.direccion || ciMatch.direccion || '',
            padreMadre: ciMatch.padreMadre || '',
            telefono: ciMatch.telefono || ''
          }
        });
        continue;
      }
    }

    // 4. New student
    results.push({
      action: 'CREATE',
      existingId: null,
      originalName: null,
      data: {
        apellidos: p.apellidos,
        nombres: p.nombres,
        rude: p.rude,
        ci: p.ci,
        genero: p.genero,
        fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : null,
        edad: p.edad,
        direccion: p.direccion,
        padreMadre: '',
        telefono: ''
      }
    });
  }

  return {
    results,
    stats: {
      totalInPdf: pdfStudents.length,
      updatedCount: results.filter(r => r.action === 'UPDATE').length,
      createdCount: results.filter(r => r.action === 'CREATE').length,
      unmatchedDbCount: dbStudents.length - matchedDbIds.size
    }
  };
}

module.exports = {
  parseSiePdfBuffer,
  matchAndMergeStudents
};
