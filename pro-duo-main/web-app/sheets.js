/* ============================================================================
 * Irriga.ai Pro-Duo · v1.5.2-Argon — Sheets / Modais Interativos (sheets.js)
 * "Simplicidade de uso sem perda de funcionalidade"
 * ========================================================================== */
const Y = window.IrrigaYaml;
let sintomasSelecionados = [];
let relatoClaudeTexto = '';

function abrirModal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="scrim" onclick="if(event.target===this)fecharModal()">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>
      ${html}
    </div>
  </div>`;
}
function fecharModal() {
  const m = document.getElementById('modal');
  if (m) m.innerHTML = '';
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

function destravarPeloModal(btn) {
  solicitarDestravamentoComPin(() => {
    if (btn) {
      const box = btn.closest('.locked-note') || btn.closest('.alert.warn') || btn.parentElement;
      if (box) {
        box.outerHTML = `<div class="alert success" style="margin-top:8px;padding:8px 12px;font-size:13px;display:flex;align-items:center;gap:6px"><span>✅ Painel destravado para edições</span></div>`;
      }
    }
    const m = document.getElementById('modal');
    if (m) {
      m.querySelectorAll('[disabled]').forEach((el) => {
        el.removeAttribute('disabled');
        el.style.opacity = '1';
      });
    }
  });
}

function avisoCadeado() {
  if (!S.ui.locked) return '';
  return `<div class="locked-note row between">
    <span>🔒 Cadeado ativo contra toques acidentais.</span>
    <button class="btn sm" style="background:var(--card);padding:5px 10px" onclick="destravarPeloModal(this)">🔓 Destravar</button>
  </div>`;
}

const PIN_LOCKOUT_KEY = 'irriga_pin_lockout_ts';
const PIN_ATTEMPTS_KEY = 'irriga_pin_attempts_cnt';

function verificarLockoutPin() {
  const lockoutUntil = parseInt(localStorage.getItem(PIN_LOCKOUT_KEY) || '0', 10);
  const agora = Date.now();
  if (lockoutUntil > agora) {
    return Math.ceil((lockoutUntil - agora) / 1000);
  }
  return 0;
}

function registrarErroPin() {
  const tentativas = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10) + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(tentativas));
  if (tentativas >= 5) {
    const lockoutUntil = Date.now() + 300000; // 5 minutos
    localStorage.setItem(PIN_LOCKOUT_KEY, String(lockoutUntil));
    if (typeof audit === 'function') {
      audit('segurança', '🚨 5 erros consecutivos de PIN: painel bloqueado por 5 minutos (Anti-Brute-Force)', 'segurança');
    }
    return { bloqueado: true, segundos: 300 };
  } else if (tentativas >= 3) {
    const lockoutUntil = Date.now() + 60000; // 1 minuto
    localStorage.setItem(PIN_LOCKOUT_KEY, String(lockoutUntil));
    if (typeof audit === 'function') {
      audit('segurança', '⚠️ 3 erros consecutivos de PIN: painel bloqueado por 1 minuto (Anti-Brute-Force)', 'segurança');
    }
    return { bloqueado: true, segundos: 60 };
  }
  return { bloqueado: false, tentativas, restantes: Math.max(1, 3 - tentativas) };
}

function limparErrosPin() {
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}

function abrirModalPin(onSuccess) {
  const segRest = verificarLockoutPin();
  if (segRest > 0) {
    abrirModal(`
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:36px">🛑</div>
        <h3 style="margin-top:6px;color:var(--red)">Painel Bloqueado</h3>
        <p class="t13 mute" style="margin-top:4px">Excesso de tentativas incorretas de PIN.</p>
        <div class="card" style="margin:16px 0;background:var(--red-bg);border:1px solid var(--red-bd);padding:12px">
          <div class="t14 b" style="color:var(--red)">Proteção Anti-Brute-Force Ativa</div>
          <div class="t13" style="margin-top:4px">Aguarde <b>${segRest} segundos</b> para tentar novamente.</div>
        </div>
        <button class="btn full" onclick="fecharModal()">Fechar</button>
      </div>
    `);
    return;
  }

  let pinDigitado = '';
  function atualizarVisorPin() {
    const visor = document.getElementById('pin-visor-dots');
    if (!visor) return;
    visor.innerHTML = [0, 1, 2, 3].map((idx) => {
      const preenchido = idx < pinDigitado.length;
      return `<span style="width:14px;height:14px;border-radius:50%;background:${preenchido ? 'var(--green)' : 'var(--line)'};border:2px solid ${preenchido ? 'var(--green)' : 'var(--mute)'};display:inline-block"></span>`;
    }).join('');
  }

  window._digitarPin = function(digito) {
    if (verificarLockoutPin() > 0) {
      abrirModalPin(onSuccess);
      return;
    }
    if (pinDigitado.length < 4) {
      pinDigitado += digito;
      atualizarVisorPin();
      if (pinDigitado.length === 4) {
        setTimeout(window._confirmarPin, 120);
      }
    }
  };

  window._apagarPin = function() {
    if (pinDigitado.length > 0) {
      pinDigitado = pinDigitado.slice(0, -1);
      atualizarVisorPin();
    }
  };

  window._confirmarPin = function() {
    const segRest = verificarLockoutPin();
    if (segRest > 0) {
      toast(`🔒 Painel temporariamente bloqueado (${segRest}s restantes).`);
      abrirModalPin(onSuccess);
      return;
    }
    const pinCorreto = S.security?.pin || '1234';
    if (pinDigitado === pinCorreto) {
      limparErrosPin();
      S.ui.locked = false;
      if (typeof iniciarTimerRelock === 'function') iniciarTimerRelock();
      salvar();
      render();
      fecharModal();
      toast('🔓 Painel destravado com sucesso!');
      if (typeof onSuccess === 'function') onSuccess();
    } else {
      const visor = document.getElementById('pin-visor-dots');
      if (visor) {
        visor.style.transform = 'translateX(8px)';
        setTimeout(() => { if (visor) visor.style.transform = 'translateX(-8px)'; }, 70);
        setTimeout(() => { if (visor) visor.style.transform = 'translateX(0)'; }, 140);
      }
      const res = registrarErroPin();
      if (res.bloqueado) {
        toast(`🚨 Bloqueio de segurança: aguarde ${res.segundos}s para novas tentativas.`);
        abrirModalPin(onSuccess);
        return;
      }
      toast(`❌ Senha incorreta! Restam ${res.restantes} tentativa(s) antes do bloqueio.`);
      pinDigitado = '';
      atualizarVisorPin();
    }
  };

  abrirModal(`
    <div style="text-align:center;padding:10px 0">
      <div style="font-size:36px">🔒</div>
      <h3 style="margin-top:6px">Destravar Painel</h3>
      <p class="t13 mute" style="margin-top:2px">Digite o PIN de 4 dígitos para liberar alterações.</p>
      
      <div id="pin-visor-dots" style="display:flex;justify-content:center;gap:12px;margin:20px 0;transition:transform .15s ease">
        <span style="width:14px;height:14px;border-radius:50%;background:var(--line);border:2px solid var(--mute);display:inline-block"></span>
        <span style="width:14px;height:14px;border-radius:50%;background:var(--line);border:2px solid var(--mute);display:inline-block"></span>
        <span style="width:14px;height:14px;border-radius:50%;background:var(--line);border:2px solid var(--mute);display:inline-block"></span>
        <span style="width:14px;height:14px;border-radius:50%;background:var(--line);border:2px solid var(--mute);display:inline-block"></span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;max-width:240px;margin:0 auto">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
          <button class="btn" style="height:54px;font-size:20px;font-weight:700;border-radius:14px" onclick="window._digitarPin('${n}')">${n}</button>
        `).join('')}
        <button class="btn" style="height:54px;font-size:18px;border-radius:14px" onclick="window._apagarPin()">⌫</button>
        <button class="btn" style="height:54px;font-size:20px;font-weight:700;border-radius:14px" onclick="window._digitarPin('0')">0</button>
        <button class="btn green" style="height:54px;font-size:16px;font-weight:700;border-radius:14px" onclick="window._confirmarPin()">✓</button>
      </div>

      <div style="margin-top:16px">
        <button class="btn sm" onclick="fecharModal()">Cancelar</button>
      </div>
    </div>
  `);
}

function trocarPinModal() {
  if (S.ui.locked && S.security?.enabled !== false) {
    solicitarDestravamentoComPin(trocarPinModal);
    return;
  }
  abrirModal(`
    <h3>🔑 Alterar PIN de Segurança</h3>
    <p class="t13 mute">Defina um novo PIN de 4 dígitos para proteger o painel contra alterações indevidas.</p>
    <div class="field" style="margin-top:14px">
      <label>Novo PIN (4 dígitos numéricos)</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="input-novo-pin" type="password" maxlength="4" pattern="[0-9]*" placeholder="••••" style="font-size:22px;letter-spacing:8px;text-align:center" />
        <button class="btn" type="button" style="height:46px;padding:0 12px" onclick="const inp=document.getElementById('input-novo-pin');if(inp){inp.type=inp.type==='password'?'text':'password';this.innerText=inp.type==='password'?'👁️':'🔒';}">👁️</button>
      </div>
    </div>
    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn primary full" onclick="salvarNovoPin()">Salvar Novo PIN</button>
      <button class="btn full" onclick="abrirAjustes()">Voltar</button>
    </div>
  `);
}

function salvarNovoPin() {
  const inp = document.getElementById('input-novo-pin');
  const val = inp ? inp.value.trim() : '';
  if (!val || val.length !== 4 || isNaN(val)) {
    toast('❌ Digite exatamente 4 dígitos numéricos!');
    return;
  }
  if (!S.security) S.security = { pin: '1234', enabled: true };
  S.security.pin = val;
  salvarConfigCloud();
  toast('✅ PIN alterado com sucesso!');
  abrirAjustes();
}

window._toggleVerPin = function() {
  const el = document.getElementById('pin-display-masked');
  if (el) {
    if (el.innerText === '••••') {
      el.innerText = S.security?.pin || '1234';
    } else {
      el.innerText = '••••';
    }
  }
};

/* ============================================================================
 * 1. MODAL DAS LUZES DE ESPIA (CLICÁVEL MESMO COM CADEADO 🔒 TRANCADO)
 * ========================================================================== */
function abrirEspia(id) {
  const lista = window.ULTIMAS_ESPIAS || [];
  const e = lista.find((x) => x.id === id) || lista[0];
  if (!e) return;

  const outras = lista.filter((x) => x.id !== e.id);

  abrirModal(`
    <div class="row between" style="margin-bottom:8px">
      <span class="pill ${e.cor}"><span class="espia-led"></span>Luz de Espia do Painel</span>
      <span class="t12 mute">${S.ui.locked ? '🔒 Consulta livre' : '🔓 Painel aberto'}</span>
    </div>
    <h3>${e.titulo}</h3>
    <p class="t14 ink2" style="margin-top:6px;line-height:1.5">${e.resumo}</p>
    ${e.detalhe ? `<div class="alert info" style="margin-top:12px"><span class="ic">💡</span><div class="t14" style="line-height:1.45">${e.detalhe}</div></div>` : ''}
    ${e.acao ? `<button class="btn primary full" style="margin-top:14px" onclick='${e.acao[1]}'>${e.acao[0]} →</button>` : ''}
    ${outras.length ? `
      <div style="margin-top:16px">
        <div class="t12 mute b" style="margin-bottom:6px;text-transform:uppercase">Outros avisos ativos:</div>
        <div class="telltales">
          ${outras.map((x) => `<button class="espia ${x.cor}" onclick="abrirEspia('${x.id}')"><span class="espia-led"></span><span>${x.ic} ${esc(x.curto)}</span></button>`).join('')}
        </div>
      </div>` : ''}
    <button class="btn full" style="margin-top:14px" onclick="fecharModal()">Fechar</button>
  `);
}

function abrirModalCota() {
  const P = planos();
  const pedidoRealL = P.pHoje.pedidoRealL || 0;
  const liberadoAutoL = P.pHoje.totalL || 0;
  const manualExtraL = manualLitrosHoje();
  const gastoTotalDiaL = liberadoAutoL + manualExtraL;
  const deficitSedeL = Math.max(0, pedidoRealL - gastoTotalDiaL);
  const passandoSede = deficitSedeL >= 5;
  const cotaL = S.quota.daily_L;
  const saldoCotaL = Math.max(0, cotaL - gastoTotalDiaL);
  const pctCota = Math.round((100 * gastoTotalDiaL) / Math.max(1, cotaL));
  const nivelCaixa = S.tank.level_L ?? 5000;
  const pctCaixa = Math.round((100 * nivelCaixa) / S.tank.capacity);

  abrirModal(`
    <div class="row between" style="margin-bottom:8px">
      <span class="pill ${passandoSede ? 'red' : (gastoTotalDiaL > cotaL ? 'blue' : 'green')}">
        ${passandoSede ? '⚠️ Alerta de Sede' : (gastoTotalDiaL > cotaL ? '💧 Cota Ultrapassada (Override)' : '✅ Cota em Ordem')}
      </span>
      <span class="t12 mute">${S.ui.locked ? '🔒 Consulta livre' : '🔓 Painel aberto'}</span>
    </div>
    <h3>🚰 Painel Hídrico & Cota de Água</h3>
    <p class="t14 ink2" style="margin-top:4px">
      Controle do volume diário de água do sítio para proteger o poço e evitar sede nas plantas.
    </p>

    <div class="card" style="margin-top:12px;background:var(--sub);padding:12px 14px">
      <div class="list t13">
        <div class="li"><span>🚰 Cota diária autorizada</span><b>${fmtL(cotaL)}</b></div>
        <div class="li"><span>🌱 Pedido real das culturas</span><b>${fmtL(pedidoRealL)}</b></div>
        <div class="li"><span>⚙️ Programado automático</span><b>${fmtL(liberadoAutoL)}</b></div>
        <div class="li"><span>💧 Override manual liberado</span><b>${fmtL(manualExtraL)}</b></div>
        <div class="li" style="border-top:1px dashed var(--line);padding-top:8px">
          <span><b>📊 Total do dia</b></span>
          <b>${fmtL(gastoTotalDiaL)} (${pctCota}%)</b>
        </div>
        <div class="li">
          <span>${gastoTotalDiaL > cotaL ? '⚠️ Acima da cota' : '🟢 Saldo restante na cota'}</span>
          <b>${gastoTotalDiaL > cotaL ? '+' + fmtL(gastoTotalDiaL - cotaL) : fmtL(saldoCotaL)}</b>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:10px;background:var(--card);padding:10px 14px;border:1px solid var(--line)">
      <div class="row between t13">
        <span>🪣 Caixa d'água de 5.000 L</span>
        <b>${fmtL(nivelCaixa)} (${pctCaixa}%)</b>
      </div>
      <div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${pctCaixa}%"></div></div>
    </div>

    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn primary full" onclick="fecharModal();abrirAjustes()">⚙️ Alterar Cota Diária ou Nível da Caixa</button>
      <button class="btn full" onclick="fecharModal()">Fechar</button>
    </div>
  `);
}

/* ============================================================================
 * 2. OS 4 BOTÕES DE AÇÃO HUMANA + NOVO OVERRIDE "REGAR AGORA" (HORAS ⇄ LITROS)
 * ========================================================================== */
function abrirPausa() {
  const p = pausado();
  if (p) {
    abrirModal(`
      <h3>▶️ Retomar irrigação automática?</h3>
      <p class="t14 ink2">${S.pause.indefinite ? 'As regas estão pausadas sem prazo.' : `A pausa atual terminaria sozinha ${quando(Date.parse(S.pause.until))}.`}</p>
      <div style="display:grid;gap:8px;margin-top:14px">
        <button class="btn primary full" onclick="retomar('app');fecharModal();toast('▶️ Piloto automático retomado!')">▶️ Retomar automático agora</button>
        <button class="btn full" onclick="pausar(4,'app');fecharModal();toast('⏸️ Pausa estendida por +4 horas')">⏸️ Continuar pausado por mais 4 h</button>
        <button class="btn full" onclick="fecharModal()">Fechar</button>
      </div>
    `);
    return;
  }
  abrirModal(`
    <h3>⏸️ Pausar regas</h3>
    <p class="t14 ink2">Na pausa com tempo, o sistema <b>volta sozinho ao automático</b> depois — sem risco de esquecer desligado.</p>
    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn primary full" onclick="pausar(2,'app');fecharModal();toast('⏸️ Pausado por 2 h (volta sozinho)')">⏸️ Pausar por 2 horas (volta sozinho)</button>
      <button class="btn full" onclick="pausar(6,'app');fecharModal();toast('⏸️ Pausado por 6 h (volta sozinho)')">⏸️ Pausar por 6 horas (trabalho na horta)</button>
      <button class="btn danger full" onclick="pausar(0,'app');fecharModal();toast('⏸️ Pausado até você retomar')">🛑 Pausar sem prazo (manual)</button>
      <button class="btn full" onclick="fecharModal()">Cancelar</button>
    </div>
  `);
}

/* Estado do Modal "Regar Agora" (Override / Flex com Conversor Horas ⇄ Litros) */
let regarModo = 'horas';      // 'horas' | 'litros'
let regarHorasVal = 1.0;      // ex.: 1 hora no total
let regarLitrosVal = 500;     // ex.: 500 litros no total
let regarZonasSel = [0, 1];   // [0, 1] (As 2 zonas), [0] (Só Zona 1), [1] (Só Zona 2)

function calcularConversaoRegar(modo, valor, zonasIdx) {
  const alvos = (Array.isArray(zonasIdx) && zonasIdx.length) ? zonasIdx : [0, 1];
  const vazoesLpm = alvos.map((idx) => Math.max(0.1, C.vazaoZona(S.zones[idx], S.soil)));
  const detalhes = [];

  if (modo === 'horas') {
    const horasTotal = Math.max(0.1, Number(valor) || 1);
    const minTotal = horasTotal * 60;
    // Se 2 zonas selecionadas, divide o tempo igualmente (ex: 1h = 30 min Zona 1 + 30 min Zona 2)
    const minPorZona = minTotal / alvos.length;
    const minutosMap = {};
    let litrosTotal = 0;
    alvos.forEach((idx, k) => {
      const l = minPorZona * vazoesLpm[k];
      minutosMap[idx] = minPorZona;
      litrosTotal += l;
      detalhes.push({
        zona: S.zones[idx].id,
        nome: S.zones[idx].nome.split('—')[0].trim(),
        minutos: minPorZona,
        litros: l,
        vazaoLph: Math.round(vazoesLpm[k] * 60),
      });
    });
    return {
      modo: 'horas',
      horasTotal,
      minTotal,
      litrosTotal,
      minutosMap,
      litrosMap: null,
      detalhes,
      frasePrincipal: `Regando por ${ fmtMin(minTotal) } → Vai gastar ${ fmtL(litrosTotal) }`,
      fraseSub: alvos.length === 2
        ? `Dividido em ${fmtMin(minPorZona)} na Zona 1 (${fmtL(detalhes[0].litros)}) + ${fmtMin(minPorZona)} na Zona 2 (${fmtL(detalhes[1].litros)})`
        : `Em ${detalhes[0].nome} com vazão de ${detalhes[0].vazaoLph} L/hora`,
    };
  } else {
    const litrosTotal = Math.max(10, Number(valor) || 500);
    // Se 2 zonas selecionadas, divide os litros igualmente entre as zonas selecionadas
    const litrosPorZona = litrosTotal / alvos.length;
    const litrosMap = {};
    let minTotal = 0;
    alvos.forEach((idx, k) => {
      const m = litrosPorZona / vazoesLpm[k];
      litrosMap[idx] = litrosPorZona;
      minTotal += m;
      detalhes.push({
        zona: S.zones[idx].id,
        nome: S.zones[idx].nome.split('—')[0].trim(),
        minutos: m,
        litros: litrosPorZona,
        vazaoLph: Math.round(vazoesLpm[k] * 60),
      });
    });
    return {
      modo: 'litros',
      horasTotal: minTotal / 60,
      minTotal,
      litrosTotal,
      minutosMap: null,
      litrosMap,
      detalhes,
      frasePrincipal: `Irrigando ${ fmtL(litrosTotal) } → Vai durar ${ fmtMin(minTotal) }`,
      fraseSub: alvos.length === 2
        ? `Dividido em ${fmtL(litrosPorZona)} na Zona 1 (${fmtMin(detalhes[0].minutos)}) + ${fmtL(litrosPorZona)} na Zona 2 (${fmtMin(detalhes[1].minutos)})`
        : `Em ${detalhes[0].nome} com vazão de ${detalhes[0].vazaoLph} L/hora`,
    };
  }
}

function atualizarInputRegar(val) {
  if (regarModo === 'horas') regarHorasVal = Math.max(0.1, Number(val) || 0.5);
  else regarLitrosVal = Math.max(10, Number(val) || 100);
  const calc = calcularConversaoRegar(regarModo, regarModo === 'horas' ? regarHorasVal : regarLitrosVal, regarZonasSel);
  const elPrin = document.getElementById('conv-frase-principal');
  const elSub = document.getElementById('conv-frase-sub');
  const elLista = document.getElementById('conv-lista-zonas');
  const elBtn = document.getElementById('btn-confirmar-override');
  if (elPrin) elPrin.textContent = calc.frasePrincipal;
  if (elSub) elSub.textContent = calc.fraseSub;
  if (elLista) {
    elLista.innerHTML = calc.detalhes.map((d) => `
      <div class="li t14">
        <span class="b">${esc(d.nome)} <span class="mute t12">(${d.vazaoLph} L/h)</span></span>
        <span><b>${fmtL(d.litros)}</b> · <b>${fmtMin(d.minutos)}</b></span>
      </div>
    `).join('');
  }
  if (elBtn) {
    elBtn.textContent = `💧 Ligar Override Agora (${fmtL(calc.litrosTotal)} · ${fmtMin(calc.minTotal)})`;
  }
}

function confirmarOverrideModal() {
  const calc = calcularConversaoRegar(regarModo, regarModo === 'horas' ? regarHorasVal : regarLitrosVal, regarZonasSel);
  acionarOverrideRega({
    zonasIdx: regarZonasSel,
    minutosPorZona: calc.minutosMap,
    litrosPorZona: calc.litrosMap,
    origem: 'app',
    rotulo: `💧 Override Manual (${calc.modo === 'horas' ? fmtMin(calc.minTotal) : fmtL(calc.litrosTotal)})`,
  });
  fecharModal();
  toast(`💧 Rega manual iniciada: ${fmtL(calc.litrosTotal)} (${fmtMin(calc.minTotal)})!`);
}

function abrirRegarAgora(zonasIniciais) {
  if (Array.isArray(zonasIniciais) && zonasIniciais.length) regarZonasSel = zonasIniciais;
  const manualAtivo = S.manual && S.manual.fim > Date.now();
  const selKey = regarZonasSel.length === 2 ? 'ambas' : String(regarZonasSel[0]);
  const calc = calcularConversaoRegar(regarModo, regarModo === 'horas' ? regarHorasVal : regarLitrosVal, regarZonasSel);

  // Calcula também quanto dá +1h Flex (30 min Z1 + 30 min Z2) para exibir no botão rápido
  const flexCalc = calcularConversaoRegar('horas', 1.0, [0, 1]);

  abrirModal(`
    <div class="row between" style="margin-bottom:4px">
      <h3>💧 Regar Agora (Override Manual)</h3>
      <span class="pill blue">Força Total</span>
    </div>
    <p class="t13 ink2">
      Ligue a irrigação a qualquer momento. Este comando é um <b>override</b>: entra na conta do dia, mas <b>libera água mesmo se a cota diária já tiver sido atingida</b>.
    </p>

    ${manualAtivo ? `
      <div class="alert warn">
        <span class="ic">💧</span>
        <div style="flex:1">
          <b>Override em andamento (${fmtL(S.manual.litrosTotal)} liberados hoje).</b>
          <div class="t12">Você pode somar mais tempo/água abaixo ou parar agora.</div>
          <div style="margin-top:6px">
            <button class="btn danger sm" onclick="cancelarRegaManual();fecharModal()">✕ Parar e cancelar rega manual</button>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Botão Rápido "Little Treat / Flex" igual ao botão físico da caixa -->
    <div class="card" style="margin-top:12px;background:var(--sub);padding:12px 14px;border:1px dashed var(--blue-bd)">
      <div class="row between">
        <div>
          <div class="t13 b">🔥 Atalho "+1 Hora Flex" (Igual ao Botão Físico)</div>
          <div class="t12 mute">30 min na Zona 1 + 30 min na Zona 2 = <b>${fmtL(flexCalc.litrosTotal)}</b></div>
        </div>
        <button class="btn blue sm" onclick="botaoFisicoFlex1Hora('app');fecharModal()">+1h Agora</button>
      </div>
    </div>

    <!-- 1. Seleção de Zonas -->
    <div class="field">
      <label>1. Onde você quer irrigar?</label>
      <div class="seg">
        <button class="${selKey === 'ambas' ? 'sel' : ''}" onclick="regarZonasSel=[0,1];abrirRegarAgora()">As 2 zonas (1 e 2)</button>
        <button class="${selKey === '0' ? 'sel' : ''}" onclick="regarZonasSel=[0];abrirRegarAgora()">Só Zona 1</button>
        <button class="${selKey === '1' ? 'sel' : ''}" onclick="regarZonasSel=[1];abrirRegarAgora()">Só Zona 2</button>
      </div>
    </div>

    <!-- 2. Seleção de Unidade: Horas vs. Litros -->
    <div class="field">
      <label>2. Como prefere definir a rega?</label>
      <div class="seg">
        <button class="${regarModo === 'horas' ? 'sel' : ''}" onclick="regarModo='horas';abrirRegarAgora()">⏱️ Por Tempo (Horas)</button>
        <button class="${regarModo === 'litros' ? 'sel' : ''}" onclick="regarModo='litros';abrirRegarAgora()">🪣 Por Volume (Litros)</button>
      </div>
    </div>

    <!-- 3. Entrada de Valor + Atalhos Rápidos -->
    ${regarModo === 'horas' ? `
      <div class="field">
        <label>Quantas horas de rega? (Ex.: 0,5h = 30 min · 2h = 2 horas)</label>
        <div class="chips" style="margin-bottom:8px">
          ${[
            { h: 0.5, lbl: '30 min (0,5h)' },
            { h: 1.0, lbl: '1 hora' },
            { h: 1.5, lbl: '1h 30m' },
            { h: 2.0, lbl: '2 horas' },
            { h: 3.0, lbl: '3 horas' },
          ].map((op) => `<button class="chip ${Math.abs(regarHorasVal - op.h) < 0.05 ? 'sel' : ''}" onclick="regarHorasVal=${op.h};abrirRegarAgora()">${op.lbl}</button>`).join('')}
        </div>
        <input type="number" step="0.25" min="0.1" max="12" value="${regarHorasVal}" oninput="atualizarInputRegar(this.value)" placeholder="Digite as horas (ex: 2)" />
      </div>
    ` : `
      <div class="field">
        <label>Quantos litros de água quer jogar?</label>
        <div class="chips" style="margin-bottom:8px">
          ${[200, 500, 1000, 1500, 2000].map((l) => `<button class="chip ${Math.abs(regarLitrosVal - l) < 5 ? 'sel' : ''}" onclick="regarLitrosVal=${l};abrirRegarAgora()">${fmtL(l)}</button>`).join('')}
        </div>
        <input type="number" step="50" min="20" max="5000" value="${regarLitrosVal}" oninput="atualizarInputRegar(this.value)" placeholder="Digite os litros (ex: 1500)" />
      </div>
    `}

    <!-- 4. Painel de Conversão Automática em Tempo Real (Horas ⇄ Litros) -->
    <div class="conv-box">
      <div class="t12 b" style="text-transform:uppercase;letter-spacing:.04em;opacity:.85">🔄 Conversão Automática</div>
      <div id="conv-frase-principal" style="font-size:17px;font-weight:850;margin-top:3px">${esc(calc.frasePrincipal)}</div>
      <div id="conv-frase-sub" class="t12" style="margin-top:3px;opacity:.9">${esc(calc.fraseSub)}</div>
    </div>

    <div id="conv-lista-zonas" class="card" style="margin-top:10px;background:var(--sub);padding:10px 14px">
      ${calc.detalhes.map((d) => `
        <div class="li t14">
          <span class="b">${esc(d.nome)} <span class="mute t12">(${d.vazaoLph} L/h)</span></span>
          <span><b>${fmtL(d.litros)}</b> · <b>${fmtMin(d.minutos)}</b></span>
        </div>
      `).join('')}
    </div>

    <div style="display:grid;gap:8px;margin-top:14px">
      <button id="btn-confirmar-override" class="btn blue full" onclick="confirmarOverrideModal()">
        💧 Ligar Override Agora (${fmtL(calc.litrosTotal)} · ${fmtMin(calc.minTotal)})
      </button>
      <button class="btn full" onclick="fecharModal()">Fechar</button>
    </div>
  `);
}

function abrirBoost() {
  const atual = S.boost.pct > 0 && Date.parse(S.boost.until) > Date.now() ? S.boost.pct : 0;
  abrirModal(`
    <h3>🌧️ "Era bom que chovesse"</h3>
    <p class="t14 ink2">Achou o dia muito quente ou seco? Aumente a água das próximas <b>24 horas</b> com 1 toque. Depois volta sozinho ao normal.</p>
    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn ${atual === 25 ? 'primary' : ''} full" onclick="S.boost={pct:25,until:new Date(Date.now()+86400e3).toISOString()};S.boostLog.push(hoje());audit('app','🌧️ Era bom que chovesse: +25% por 24 h','boost',{pct:25});enviarComando({acao:'boost',pct:25});salvarConfigCloud();sincronizarEsp32();salvarLocal();render();fecharModal();toast('🌧️ +25% ativado por 24 horas!')">🌧️ Mais água (+25% por 24 horas)</button>
      <button class="btn ${atual === 50 ? 'primary' : ''} full" onclick="S.boost={pct:50,until:new Date(Date.now()+86400e3).toISOString()};S.boostLog.push(hoje());audit('app','🌧️ Era bom que chovesse: +50% por 24 h','boost',{pct:50});enviarComando({acao:'boost',pct:50});salvarConfigCloud();sincronizarEsp32();salvarLocal();render();fecharModal();toast('⛈️ +50% ativado por 24 horas!')">⛈️ Bastante água (+50% por 24 horas)</button>
      ${atual > 0 ? `<button class="btn danger full" onclick="cancelarBoost();fecharModal()">✕ Cancelar reforço (+${atual}%)</button>` : ''}
      <button class="btn full" onclick="fecharModal()">Fechar</button>
    </div>
  `);
}

function abrirChuva() {
  const hojeMm = S.chuvaLocal[hoje()] || 0;
  abrirModal(`
    <h3>☔ "Choveu aqui"</h3>
    <p class="t14 ink2">Caiu uma chuva no sítio? Anote aqui para o sistema descontar essa água e economizar a caixa de 5.000 L.</p>
    ${hojeMm > 0 ? `
      <div class="alert good">
        <span class="ic">✅</span>
        <div style="flex:1">
          Já anotado hoje: <b>${hojeMm} mm</b> de chuva.
          <div style="margin-top:6px">
            <button class="btn danger sm" onclick="cancelarChuvaHoje();fecharModal()">✕ Desfazer registro de chuva</button>
          </div>
        </div>
      </div>` : ''}
    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn primary full" onclick="choveuAqui(5,'app');fecharModal();toast('☔ +5 mm anotados!')">🌦️ Chuva fraca (~5 mm · só apagou a poeira)</button>
      <button class="btn primary full" onclick="choveuAqui(15,'app');fecharModal();toast('☔ +15 mm anotados!')">🌧️ Chuva boa (~15 mm · molhou bem a terra)</button>
      <button class="btn primary full" onclick="choveuAqui(30,'app');fecharModal();toast('☔ +30 mm anotados!')">⛈️ Chuva forte (~30 mm · lavou tudo)</button>
      <button class="btn full" onclick="fecharModal()">Fechar</button>
    </div>
  `);
}

/* ============================================================================
 * 3. DETALHES E HIDRÁULICA DA ZONA POR METROS DE FITA DE GOTEJAMENTO
 * ========================================================================== */
function salvarHidraulicaFita(i, campo, valor) {
  if (S.ui.locked) {
    solicitarDestravamentoComPin(() => salvarHidraulicaFita(i, campo, valor));
    return;
  }
  const z = S.zones[i];
  const num = Number(valor);
  if (!num || num <= 0) return;
  if (campo === 'tape_meters') z.tape_meters = C.clamp(Math.round(num), 10, 2000);
  if (campo === 'emitter_spacing_cm') {
    z.emitter_spacing_cm = C.clamp(Math.round(num), 10, 100);
    z.emitter_spacing_m = z.emitter_spacing_cm / 100;
  }
  if (campo === 'emitter_flow_lph') {
    z.emitter_flow_lph = C.clamp(Number(num.toFixed(2)), 0.2, 10);
    z.emitter_q_lph = z.emitter_flow_lph;
  }
  // Quando o usuário altera a fita/gotejador, usa a nova vazão calculada pela fita
  z.flow_cal_lpm = 0;
  const g = C.geometria(z, S.soil);
  audit('app', `📏 Zona ${z.id}: ${g.metros}m de fita · furos a ${g.espacamentoCm}cm · ${g.vazaoFuroLph} L/h → ${Math.round(g.vazaoLph)} L/h`, 'config');
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal();
  render();
  abrirZona(i);
  toast('📏 Medidas salvas e sincronizadas na nuvem!');
}

function abrirZona(i) {
  const z = S.zones[i];
  const P = planos();
  const d = P.pHoje.porZona[i];
  const cd = d.cd;
  const g = C.geometria(z, S.soil);
  const dis = S.ui.locked ? 'disabled style="opacity:.55"' : '';

  abrirModal(`
    <h3>${cd ? cd.crop.emoji : '🟫'} ${esc(z.nome)}</h3>
    <p class="t14 mute">${cd ? `${cd.crop.nome} (${cd.crop.familia}) · Dia ${cd.dap} de ${cd.ciclo} · ${cd.nomeFase}` : 'Zona sem cultura ativa'}</p>
    ${avisoCadeado()}

    <!-- 1. Metragem da Fita de Gotejamento -->
    <div class="field">
      <label>📏 Metragem total de fita de gotejamento na zona (<b>${g.metros} metros</b>)</label>
      <div class="chips" style="margin-bottom:7px">
        ${[60, 80, 100, 120, 160, 200].map((m) => `
          <button ${dis} class="chip ${g.metros === m ? 'sel' : ''}" onclick="salvarHidraulicaFita(${i},'tape_meters',${m})">${m} m</button>
        `).join('')}
      </div>
      <input ${dis} type="number" step="5" min="10" max="2000" value="${g.metros}" onchange="salvarHidraulicaFita(${i},'tape_meters',this.value)" placeholder="Metros totais de fita (ex: 100)" />
    </div>

    <!-- 2. Espaçamento entre Gotejadores -->
    <div class="field">
      <label>📍 Espaçamento entre gotejadores na fita (<b>a cada ${g.espacamentoCm} cm</b>)</label>
      <div class="seg">
        ${[20, 30, 40, 50].map((cm) => `
          <button ${dis} class="${g.espacamentoCm === cm ? 'sel' : ''}" onclick="salvarHidraulicaFita(${i},'emitter_spacing_cm',${cm})">${cm} cm</button>
        `).join('')}
      </div>
    </div>

    <!-- 3. Vazão por Hora de Cada Gotejador -->
    <div class="field">
      <label>💧 Vazão de cada gotejador (<b>${g.vazaoFuroLph} L/hora por furo</b>)</label>
      <div class="chips" style="margin-bottom:7px">
        ${[
          { v: 0.8, lbl: '0,8 L/h (gravidade baixa)' },
          { v: 1.2, lbl: '1,2 L/h (gravidade padrão)' },
          { v: 1.6, lbl: '1,6 L/h (nominal)' },
          { v: 2.0, lbl: '2,0 L/h' },
        ].map((op) => `
          <button ${dis} class="chip ${Math.abs(g.vazaoFuroLph - op.v) < 0.05 ? 'sel' : ''}" onclick="salvarHidraulicaFita(${i},'emitter_flow_lph',${op.v})">${op.lbl}</button>
        `).join('')}
      </div>
      <input ${dis} type="number" step="0.1" min="0.3" max="8" value="${g.vazaoFuroLph}" onchange="salvarHidraulicaFita(${i},'emitter_flow_lph',this.value)" placeholder="Vazão L/h de cada gotejador" />
    </div>

    <!-- Resumo Hidráulico Calculado pela Fita -->
    <div class="card" style="margin-top:12px;background:var(--sub);padding:12px 14px">
      <div class="t12 mute b" style="text-transform:uppercase;margin-bottom:6px">🚰 Volume de Saída Calculado da Zona ${z.id}</div>
      <div class="list t14">
        <div class="li"><span>Total de gotejadores (${g.metros}m ÷ ${g.espacamentoCm}cm)</span><b>${g.gotejadores} gotejadores</b></div>
        <div class="li"><span>Saída por hora da zona</span><b style="color:var(--blue)">${Math.round(d.vazaoLph).toLocaleString('pt-BR')} L/hora</b></div>
        <div class="li"><span>Saída por minuto</span><b>${d.vazaoLpm.toFixed(1)} L/min</b></div>
      </div>
    </div>

    <!-- 4. Palhada e Ajuste Fino Permanente -->
    <div class="field">
      <label>🌾 Cobertura morta no solo (Palhada)</label>
      <div class="seg">
        <button ${dis} class="${!z.mulch ? 'sel' : ''}" onclick="if(!S.ui.locked){S.zones[${i}].mulch=false;salvarConfigCloud();sincronizarEsp32();salvarLocal();render();abrirZona(${i});}">Terra descoberta</button>
        <button ${dis} class="${z.mulch ? 'sel' : ''}" onclick="if(!S.ui.locked){S.zones[${i}].mulch=true;audit('app','🌾 Palhada ativada na Zona ${z.id}','config');salvarConfigCloud();sincronizarEsp32();salvarLocal();render();abrirZona(${i});}">🌾 Com palhada (−15% água)</button>
      </div>
    </div>

    <div class="field">
      <label>🎛️ Ajuste fino permanente da zona (${z.fine_pct >= 0 ? '+' : ''}${z.fine_pct || 0}%)</label>
      <div class="seg">
        ${[-20, -10, 0, 10, 20].map((v) => `<button ${dis} class="${(z.fine_pct || 0) === v ? 'sel' : ''}" onclick="if(!S.ui.locked){S.zones[${i}].fine_pct=${v};audit('app','Zona ${z.id}: ajuste fino ${v > 0 ? '+' + v : v}%','config');salvarConfigCloud();sincronizarEsp32();salvarLocal();render();abrirZona(${i});}">${v > 0 ? '+' + v : v}%</button>`).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
      <button class="btn" onclick="abrirGuiaCulturas(${i})">📖 Guia & Espaçamentos</button>
      <button class="btn primary" onclick="abrirPlantio(${i})">🔄 Trocar cultura</button>
    </div>
    <button class="btn full" style="margin-top:10px" onclick="fecharModal()">Fechar</button>
  `);
}

/* ============================================================================
 * 4. GUIA DE CULTURAS & ESPAÇAMENTOS (CONSULTA 100% SEGURA — NÃO APAGA SAFRA!)
 * ========================================================================== */
function abrirGuiaCulturas(i, cropIdSel) {
  const z = S.zones[i];
  const famAtual = (z.crop && C.CROPS[z.crop.id] ? C.CROPS[z.crop.id].familia : z.crop?.anterior) || 'Leguminosas';
  const recomendadas = C.sugerirRotacao(famAtual);
  const cid = cropIdSel || recomendadas[0]?.id || 'feijao_verde';
  const c = C.CROPS[cid];
  const prev = C.previaSafra(z, S.soil, cid, hoje());
  const ehRecomendada = c.familia !== famAtual;

  abrirModal(`
    <div class="row between" style="margin-bottom:6px">
      <span class="pill green">📖 Modo Consulta Segura</span>
      <span class="t12 mute">Não altera sua safra atual</span>
    </div>
    <h3>📖 Culturas Possíveis & Espaçamentos</h3>
    <p class="t13 ink2">
      Consulte com calma o <b>espaçamento mínimo entre ruas (fitas)</b>, <b>espaçamento entre plantas</b> e preparo do solo para se planejar antes da próxima safra na <b>${esc(z.nome.split('—')[0].trim())}</b>.
    </p>

    <div class="field">
      <label>Toque em uma cultura para ver o preparo e espaçamento:</label>
      <div class="chips">
        ${Object.entries(C.CROPS).map(([id, cr]) => {
          const boaRotacao = cr.familia !== famAtual;
          return `<button class="chip ${id === cid ? 'sel' : ''}" onclick="abrirGuiaCulturas(${i},'${id}')">${cr.emoji} ${cr.nome}${boaRotacao ? '' : ' ⚠️'}</button>`;
        }).join('')}
      </div>
    </div>

    <!-- Ficha Técnica de Preparo e Espaçamento da Cultura Selecionada -->
    <div class="card" style="margin-top:12px;background:var(--sub);padding:14px 16px">
      <div class="row between">
        <div style="font-size:17px;font-weight:850">${c.emoji} ${esc(c.nome)} <span class="t12 mute">(${esc(c.familia)})</span></div>
        <span class="pill ${ehRecomendada ? 'green' : 'amber'}">${ehRecomendada ? '✅ Ótima rotação' : '⚠️ Mesma família'}</span>
      </div>

      <div class="shifts-grid" style="margin-top:10px">
        <div class="shift-box" style="background:var(--card)">
          <div class="t12 mute b">↔️ ESPAÇAMENTO DA RUA</div>
          <div class="t14 b" style="margin-top:3px;color:var(--blue)">${esc(c.espacamento_ruas_m || '1,0 m')}</div>
          <div class="t12 mute" style="margin-top:2px">Distância mínima entre fitas</div>
        </div>
        <div class="shift-box" style="background:var(--card)">
          <div class="t12 mute b">🌱 ENTRE PLANTAS / COVAS</div>
          <div class="t14 b" style="margin-top:3px;color:var(--green)">${esc(c.espacamento_plantas_m || '0,30 m')}</div>
          <div class="t12 mute" style="margin-top:2px">Ao longo da linha de gotejo</div>
        </div>
      </div>

      <div class="list t13" style="margin-top:10px">
        <div class="li"><span>⏳ Duração média do ciclo</span><b>${prev.ciclo} dias</b></div>
        <div class="li"><span>💧 Consumo médio na zona</span><b>~${fmtL(prev.totalL / prev.ciclo)}/dia (pico ${fmtL(prev.picoLDia)}/dia)</b></div>
        <div class="li"><span>🚜 Preparo recomendado</span><b style="text-align:right;max-width:62%">${esc(c.preparo || 'Canteiro adubado com fita central')}</b></div>
        <div class="li"><span>🧺 Ponto de colheita</span><b style="text-align:right;max-width:62%">${esc(c.colheita)}</b></div>
        ${c.reta_final ? `
          <div class="li">
            <span>🍯 Restrição hídrica final</span>
            <b style="text-align:right;max-width:62%;color:var(--amber)">Nos últimos ${c.reta_final.dias}d reduz rega p/ ${esc(c.reta_final.motivo)}</b>
          </div>
        ` : ''}
      </div>
    </div>

    <div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn full" onclick="fecharModal()">✅ Fechar guia (manter safra atual intacta)</button>
      <button class="btn sm" style="color:var(--amber);border-color:var(--amber-bd)" onclick="abrirPlantio(${i},'${cid}')">
        Já colhi e quero substituir a cultura desta zona →
      </button>
    </div>
  `);
}

/* ============================================================================
 * 5. TROCAR CULTURA COM DUPLA CONFIRMAÇÃO EXPLÍCITA (EVITA PERDA ACIDENTAL)
 * ========================================================================== */
function executarTrocaCulturaConfirmada(i, cid, dt, famAnterior) {
  if (S.ui.locked) {
    solicitarDestravamentoComPin(() => executarTrocaCulturaConfirmada(i, cid, dt, famAnterior));
    return;
  }
  const z = S.zones[i];
  const antiga = z.crop && C.CROPS[z.crop.id] ? C.CROPS[z.crop.id].nome : 'canteiro livre';
  z.enabled = true;
  if (cid === 'nenhuma' || !cid) {
    z.crop = null;
    z.restricao_modo = 'auto';
    audit('app', `🔄 Confirmou canteiro livre na Zona ${z.id}: encerrou ${antiga} → Canteiro Livre (0 L/dia)`, 'config');
    toast(`🟫 Zona ${z.id} agora está como Canteiro Livre!`);
  } else {
    z.crop = { id: cid, plantio: dt, anterior: famAnterior };
    z.restricao_modo = 'auto';
    z.Dr_mm = 1.0;
    audit('app', `🔄 Confirmou troca de cultura na Zona ${z.id}: encerrou ${antiga} → plantou ${C.CROPS[cid].emoji} ${C.CROPS[cid].nome}`, 'config');
    toast(`🌱 Troca confirmada: ${C.CROPS[cid].nome} ativo na Zona ${z.id}!`);
  }
  salvarConfigCloud();
  sincronizarEsp32();
  render();
  fecharModal();
}

function abrirPlantio(i, cropIdSel, dataSel, pedirConfirmacao = false) {
  const z = S.zones[i];
  const temCulturaAtiva = !!(z.enabled && z.crop && z.crop.id && C.CROPS[z.crop.id]);
  const cropAtual = temCulturaAtiva ? C.CROPS[z.crop.id] : null;
  const dapAtual = temCulturaAtiva ? (C.daysBetween(z.crop.plantio, hoje()) + 1) : 0;
  const cicloAtual = cropAtual ? cropAtual.dias.reduce((a, b) => a + b, 0) : 0;

  const famAnterior = (cropAtual ? cropAtual.familia : z.crop?.anterior) || 'Leguminosas';
  const recomendadas = C.sugerirRotacao(famAnterior);
  const cid = cropIdSel !== undefined ? cropIdSel : (temCulturaAtiva ? z.crop.id : 'nenhuma');
  const isNenhuma = cid === 'nenhuma' || !cid;
  const cNova = isNenhuma
    ? { nome: 'Nenhuma (Canteiro Livre)', emoji: '🟫', familia: 'Nenhuma', espacamento_ruas_m: '—', espacamento_plantas_m: '—' }
    : (C.CROPS[cid] || C.CROPS['feijao_verde']);
  const dt = dataSel || hoje();
  const prev = isNenhuma ? { ciclo: 0, colheita: dt, totalL: 0 } : C.previaSafra(z, S.soil, cid, dt);
  const sug = (!isNenhuma && C.sugerirDataPlantio) ? C.sugerirDataPlantio(S, i, cid, dt) : null;
  const opcaoAtual = sug ? (sug.opcoes.find((o) => o.plantio === dt) || sug.opcoes[0]) : null;
  const choqueCota = opcaoAtual && !opcaoAtual.cabeNaCota;
  const melhorData = sug ? sug.melhor : null;

  abrirModal(`
    <div class="row between" style="margin-bottom:4px">
      <h3>🔄 ${temCulturaAtiva ? 'Trocar Cultura da Zona' : 'Cadastrar Cultura'} · Zona ${z.id}</h3>
      <button class="btn sm" onclick="abrirGuiaCulturas(${i},'${isNenhuma ? 'feijao_verde' : cid}')">📖 Só consultar guia</button>
    </div>

    ${temCulturaAtiva ? `
      <div class="alert warn" style="margin-top:6px">
        <span class="ic">⚠️</span>
        <div>
          <b>Safra em andamento: ${cropAtual.emoji} ${esc(cropAtual.nome)} (Dia ${dapAtual} de ${cicloAtual}).</b>
          <div class="t12" style="margin-top:2px">
            Use esta tela <b>apenas quando já tiver colhido</b> e for realmente iniciar a nova cultura. Para apenas planejar ou ver espaçamentos sem apagar a safra atual, toque em <b>"📖 Só consultar guia"</b> acima.
          </div>
        </div>
      </div>
    ` : ''}

    ${avisoCadeado()}

    <div class="field">
      <label>1. Escolha a nova cultura (ou deixe como canteiro livre)</label>
      <div class="chips">
        <button class="chip ${isNenhuma ? 'sel' : ''}" onclick="abrirPlantio(${i},'nenhuma','${dt}',false)">🟫 Nenhuma (Canteiro Livre)</button>
        ${Object.entries(C.CROPS).map(([id, c]) => {
          const rec = c.familia !== famAnterior;
          return `<button class="chip ${id === cid ? 'sel' : ''}" onclick="abrirPlantio(${i},'${id}','${dt}',false)">${c.emoji} ${c.nome}${rec ? '' : ' ⚠️'}</button>`;
        }).join('')}
      </div>
      <div class="t12 mute" style="margin-top:6px">
        ${isNenhuma
          ? '🟫 <b>Canteiro livre:</b> Irrigação automática = 0 L/dia. O botão manual "Regar Agora" continua liberado para molhar a terra antes do plantio.'
          : (cNova.familia === famAnterior
            ? `⚠️ Atenção: ${cNova.nome} repete a família <b>${famAnterior}</b> na mesma zona.`
            : `✅ Boa rotação (${cNova.familia}): ${C.sugerirRotacao(famAnterior).find((x) => x.id === cid)?.motivo || 'descansa a terra'}.`)}
      </div>
    </div>

    ${!isNenhuma ? `
      <div class="field">
        <label>2. Data do plantio da nova safra</label>
        <input type="date" value="${dt}" onchange="abrirPlantio(${i},'${cid}',this.value,false)" />
      </div>

      <!-- Resumo + Espaçamentos Mínimos da Nova Cultura -->
      <div class="card" style="margin-top:12px;background:var(--sub);padding:12px 14px">
        <div class="t12 mute b" style="text-transform:uppercase;margin-bottom:6px">📐 Espaçamento & Ciclo de ${cNova.emoji} ${cNova.nome}</div>
        <div class="list t13">
          <div class="li"><span>↔️ Espaçamento mínimo da rua</span><b>${esc(cNova.espacamento_ruas_m || '1,0 m')}</b></div>
          <div class="li"><span>🌱 Espaçamento entre plantas</span><b>${esc(cNova.espacamento_plantas_m || '0,30 m')}</b></div>
          <div class="li"><span>⏳ Ciclo até a colheita</span><b>${prev.ciclo} dias (~${fmtData(prev.colheita)})</b></div>
          <div class="li"><span>💧 Consumo total estimado</span><b>${fmtL(prev.totalL)}</b></div>
        </div>
      </div>

      ${choqueCota ? `
        <div class="alert warn" style="margin-top:10px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:12px;border-radius:10px">
          <div class="t13 b" style="display:flex;align-items:center;gap:6px">
            <span>⚠️ Alerta: Risco de Estourar Cota de Água</span>
          </div>
          <p class="t12" style="margin:4px 0 8px 0;line-height:1.4">
            Plantando em <b>${fmtData(dt)}</b>, o consumo combinado das duas zonas atingirá pico de <b>${Math.round(opcaoAtual.picoCombinadoL)} L/dia</b>, superando a cota diária de <b>${S.quota.daily_L} L/dia</b>.
          </p>
          ${melhorData && melhorData.plantio !== dt ? `
            <div style="background:#fff;padding:8px 10px;border-radius:6px;border:1px dashed #d97706;margin-top:6px">
              <div class="t12" style="color:#78350f">
                💡 <b>Data recomendada para evitar choque:</b><br/>
                Plantando em <b>${fmtData(melhorData.plantio)}</b> (+${melhorData.offset} dias), o pico combinado cai para <b>${Math.round(melhorData.picoCombinadoL)} L/dia</b> ${melhorData.cabeNaCota ? '(cabe 100% na cota)' : '(mitigado)'}.
              </div>
              <button class="btn sm primary" style="margin-top:8px;width:100%" onclick="abrirPlantio(${i},'${cid}','${melhorData.plantio}',false)">
                📅 Usar Data Recomendada (${fmtData(melhorData.plantio)})
              </button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    ` : ''}

    <!-- Passo de Dupla Confirmação Explícita ("Confirmar troca de cultura") -->
    ${pedirConfirmacao ? `
      <div class="card" style="margin-top:14px;background:var(--red-bg);border:2px solid var(--red-bd);padding:14px 16px">
        <div class="t14 b" style="color:var(--red)">🛑 Confirmar Alteração?</div>
        <p class="t13 ink2" style="margin-top:4px">
          Ao confirmar, a safra atual de <b>${cropAtual ? cropAtual.nome : 'cultura anterior'} (Dia ${dapAtual})</b> será encerrada e substituída por <b>${cNova.emoji} ${cNova.nome}</b>.
        </p>
        <div style="display:grid;gap:8px;margin-top:12px">
          <button class="btn primary full" onclick="executarTrocaCulturaConfirmada(${i},'${cid}','${dt}','${famAnterior}')">
            ✅ Sim, Confirmar Alteração
          </button>
          <button class="btn full" style="background:var(--card)" onclick="abrirPlantio(${i},'${cid}','${dt}',false)">
            ⬅️ Não, voltar sem trocar
          </button>
        </div>
      </div>
    ` : `
      <div style="display:grid;gap:8px;margin-top:14px">
        ${temCulturaAtiva ? `
          <button class="btn primary full" onclick="if(S.ui.locked){solicitarDestravamentoComPin(()=>abrirPlantio(${i},'${cid}','${dt}',true));return;} abrirPlantio(${i},'${cid}','${dt}',true)">
            🔄 Preparar Alteração para ${cNova.nome}...
          </button>
        ` : `
          <button class="btn primary full" onclick="executarTrocaCulturaConfirmada(${i},'${cid}','${dt}','${famAnterior}')">
            ✅ Confirmar ${isNenhuma ? 'Canteiro Livre' : `Plantio de ${cNova.nome}`}
          </button>
        `}
        <button class="btn full" onclick="fecharModal()">Cancelar (Manter como está)</button>
      </div>
    `}
  `);
}

/* ============================================================================
 * 6. CONSULTOR CLAUDE IA (SINTOMAS RÁPIDOS + YAML)
 * ========================================================================== */
function alternarSintoma(id) {
  if (sintomasSelecionados.includes(id)) sintomasSelecionados = sintomasSelecionados.filter((x) => x !== id);
  else sintomasSelecionados.push(id);
  abrirClaude();
}

async function compartilharYamlComClaude() {
  const P = planos();
  const yamlStr = Y.gerarYaml(S, P.pHoje, { sintomas: sintomasSelecionados, relato: relatoClaudeTexto });
  const blob = new Blob([yamlStr], { type: 'text/yaml;charset=utf-8' });
  const file = new File([blob], 'plano_irrigacao_sitio.yaml', { type: 'text/yaml' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Irriga.ai Pro-Duo — Plano YAML',
        text: relatoClaudeTexto || 'Analise o arquivo plano_irrigacao_sitio.yaml do meu sítio.',
        files: [file],
      });
      audit('claude', '📤 Arquivo .yaml compartilhado com o Claude', 'claude');
      return;
    } catch (e) {}
  }

  try { await navigator.clipboard.writeText(yamlStr); } catch (e) {}
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plano_irrigacao_sitio.yaml';
  a.click();
  toast('📥 Arquivo .yaml baixado e copiado!');
}

function aplicarRespostaClaude() {
  const txt = document.getElementById('claude-yaml-in')?.value || '';
  const res = Y.importarYaml(txt, S);
  if (!res.ok) { toast('⚠️ ' + res.erros[0]); return; }
  S = Object.assign(S, res.state);
  audit('claude', `🧠 Ajuste do Claude aplicado (${res.mudancas.join(', ') || 'revisão'})`, 'claude');
  salvar(); render(); fecharModal();
  toast(`✅ Ajustes do Claude aplicados!`);
}

function abrirClaude() {
  abrirModal(`
    <h3>🤖 Consultar o Claude IA</h3>
    <p class="t14 ink2">Toque nos sintomas abaixo se notou algo diferente na planta e envie o arquivo <code>.yaml</code> para o Claude analisar.</p>

    <div class="field">
      <label>O que você observou na planta? (opcional)</label>
      <div class="chips">
        ${Y.SINTOMAS_RAPIDOS.map((s) => `
          <button class="chip ${sintomasSelecionados.includes(s.id) ? 'sel' : ''}" onclick="alternarSintoma('${s.id}')">${s.emoji} ${esc(s.label)}</button>
        `).join('')}
      </div>
    </div>

    <div class="field">
      <label>Observação ou pergunta</label>
      <input type="text" placeholder="Ex: Quero trocar a Zona 1 para feijão verde..." value="${esc(relatoClaudeTexto)}" oninput="relatoClaudeTexto=this.value" />
    </div>

    <button class="btn primary full" style="margin-top:12px" onclick="compartilharYamlComClaude()">📤 Compartilhar .YAML c/ Claude</button>

    <div class="field" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line)">
      <div class="row between" style="margin-bottom:6px">
        <label style="margin:0">Receber resposta do Claude</label>
        <button class="btn sm" onclick="document.getElementById('yaml-file').click()">📂 Abrir arquivo .yaml</button>
      </div>
      <textarea id="claude-yaml-in" rows="3" placeholder="Ou cole aqui o bloco YAML que o Claude respondeu..."></textarea>
      <button class="btn blue full" style="margin-top:8px" onclick="aplicarRespostaClaude()">📥 Aplicar Ajuste do Claude</button>
    </div>

    <button class="btn full" style="margin-top:10px" onclick="fecharModal()">Fechar</button>
  `);
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('yaml-file');
  if (inp) {
    inp.addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      const txt = await f.text();
      const res = Y.importarYaml(txt, S);
      if (!res.ok) { toast('⚠️ ' + res.erros[0]); return; }
      S = Object.assign(S, res.state);
      audit('claude', `📂 Arquivo ${f.name} importado`, 'claude');
      salvar(); render(); fecharModal();
      toast(`✅ Arquivo ${f.name} aplicado!`);
      inp.value = '';
    });
  }
});

/* ============================================================================
 * 7. AJUSTES GERAIS DO SISTEMA (SIMPLES E DIRETO)
 * ========================================================================== */
function abrirAjustes() {
  if (S.ui.locked && S.security?.enabled !== false) {
    solicitarDestravamentoComPin(abrirAjustes);
    return;
  }
  const dis = S.ui.locked ? 'disabled style="opacity:.55"' : '';
  const espOnline = !!(S.device?.online && (Date.now() - (S.device?.lastSeen || 0) < 35000));
  abrirModal(`
    <h3>⚙️ Ajustes do Sítio</h3>
    ${avisoCadeado()}

    <div class="field">
      <label>Aparência da tela</label>
      <div class="seg">
        <button class="${!S.ui.dark ? 'sel' : ''}" onclick="S.ui.dark=false;salvar();render();abrirAjustes()">☀️ Tema Claro (Sol)</button>
        <button class="${S.ui.dark ? 'sel' : ''}" onclick="S.ui.dark=true;salvar();render();abrirAjustes()">🌙 Modo Noite</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field">
        <label>Cota diária máxima (L)</label>
        <input ${dis} type="number" step="50" min="100" max="5000" value="${S.quota.daily_L}" onchange="S.quota.daily_L=C.clamp(Number(this.value),100,5000);audit('app','Cota: '+S.quota.daily_L+' L','config');salvarConfigCloud();sincronizarEsp32();salvarLocal();render()" />
      </div>
      <div class="field">
        <label>Água na caixa 5.000 L</label>
        <input ${dis} type="number" step="100" min="0" max="5000" value="${Math.round(S.tank.level_L)}" onchange="S.tank.level_L=C.clamp(Number(this.value),0,5000);salvarConfigCloud();sincronizarEsp32();salvarLocal();render()" />
      </div>
    </div>

    <div class="field">
      <label>Tipo de terra do sítio</label>
      <select ${dis} onchange="S.soil=this.value;audit('app','Solo: '+this.value,'config');salvarConfigCloud();sincronizarEsp32();salvarLocal();render()">
        ${Object.entries(C.SOLOS).map(([k, v]) => `<option value="${k}" ${S.soil === k ? 'selected' : ''}>${v.nome}</option>`).join('')}
      </select>
    </div>

    <!-- Seção de Segurança Anti-Griefing (PIN 4 Dígitos) -->
    <div class="card" style="margin-top:14px;background:var(--sub);padding:12px 14px;border:1px solid var(--line)">
      <div class="row between" style="align-items:center">
        <div>
          <div class="t13 b">🔒 Segurança Anti-Griefing (PIN)</div>
          <div class="t12 mute">Exigir senha de 4 dígitos para destravar edições</div>
        </div>
        <input ${dis} type="checkbox" style="width:20px;height:20px" ${S.security?.enabled !== false ? 'checked' : ''} onchange="if(!S.security)S.security={pin:'1234',enabled:true};S.security.enabled=this.checked;salvarConfigCloud();render();toast(this.checked?'🔒 PIN ativado':'🔓 PIN desativado');abrirAjustes()" />
      </div>
      <div class="row between" style="margin-top:10px;align-items:center;border-top:1px dashed var(--line);padding-top:8px">
        <div class="t12 mute">PIN Atual: <b id="pin-display-masked">••••</b> <button class="btn sm" onclick="window._toggleVerPin()" style="padding:2px 8px;font-size:11px;margin-left:4px" title="Ver/Ocultar PIN">👁️</button></div>
        <button ${dis} class="btn sm" onclick="trocarPinModal()">🔑 Alterar PIN</button>
      </div>
    </div>

    <!-- WhatsApp & Alertas do Sítio -->
    <div class="card" style="margin-top:14px;background:var(--sub);padding:12px 14px;border:1px solid var(--line)">
      <div class="row between" style="align-items:center">
        <div>
          <div class="t13 b">📲 WhatsApp do Sítio & Família</div>
          <div class="t12 mute">Boletins diários, Pro Tips e alertas no grupo</div>
        </div>
        <button class="btn green sm" onclick="abrirModalWhatsApp('manha')">Abrir 📲</button>
      </div>
    </div>

    <!-- Dispositivo SABIÁ (Hardware Autônomo & Nuvem) -->
    <div class="card" style="margin-top:14px;background:var(--sub);padding:12px 14px;border:1px solid var(--line)">
      <div class="t12 mute b" style="text-transform:uppercase;margin-bottom:4px">📡 SABIÁ: Sistema Autônomo de Balanço hídrico e Irrigação Assistida</div>
      <div class="t13" style="margin-bottom:8px">
        Status em Campo: <b>${espOnline ? '🟢 SABIÁ Conectado em Tempo Real' : '🟠 SABIÁ Offline (Aguardando Conexão)'}</b>
      </div>
      <button class="btn blue full sm" onclick="salvarConfigCloud();sincronizarEsp32();toast('☁️ Sincronização disparada para o SABIÁ!')">
        ☁️ Sincronizar Tudo com o SABIÁ via Nuvem
      </button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
      <a class="btn" href="./dev-gui.html" style="text-decoration:none">🛠️ Bancada de Testes</a>
      <button class="btn danger" ${dis} onclick="if(!S.ui.locked && confirm('Restaurar o estado inicial de fábrica (Canteiro Livre)?')){localStorage.removeItem(KEY);S=novoEstado();salvarConfigCloud();render();fecharModal();toast('Sistema restaurado!')}">♻️ Restaurar padrão</button>
    </div>
    <button class="btn full" style="margin-top:10px" onclick="fecharModal()">Fechar</button>
  `);
}

/* ============================================================================
 * 8. MODAL INFORMATIVO DO SABIÁ (EXPLICAÇÃO DO SERVIDOR AUTÔNOMO)
 * ========================================================================== */
function abrirModalSabia() {
  const espOnline = !!(S.device?.online && (Date.now() - (S.device?.lastSeen || 0) < 35000));
  const tel = S.device?.telemetry;
  const lastSeenStr = S.device?.lastSeen ? quando(S.device.lastSeen) : 'Nenhuma conexão recente';

  abrirModal(`
    <div class="row between" style="margin-bottom:8px;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:32px">🦅</span>
        <div>
          <h3 style="margin:0">SABIÁ</h3>
          <div class="t12 mute">Sistema Autônomo de Balanço hídrico e Irrigação Assistida</div>
        </div>
      </div>
      <span class="pill ${espOnline ? 'green' : 'amber'}" style="font-size:12px;font-weight:700">
        ${espOnline ? '🟢 Online' : '🟠 Offline'}
      </span>
    </div>

    <!-- O que é o SABIÁ e o que ele faz pelo agricultor -->
    <div class="card" style="margin-top:12px;background:var(--sub);border:1px solid var(--line);padding:14px">
      <div class="t13 b" style="margin-bottom:6px;color:var(--ink)">🌱 O que é o SABIÁ e o que ele faz por você?</div>
      <p class="t13 ink2" style="margin-bottom:10px;line-height:1.5">
        O <b>SABIÁ</b> é o servidor de tomada de decisões de irrigação eficiente da sua propriedade. Ele atua como o cérebro autônomo em campo, garantindo que suas plantas recebam exatamente a água necessária com máxima economia e segurança:
      </p>
      
      <div class="list t13">
        <div class="li" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>💧 <b>Decisão Agronômica Precisa (FAO-56):</b></span>
          <span class="mute">Calcula a sede real de cada canteiro considerando sol, vento, umidade, palhada e fase da cultura.</span>
        </div>
        <div class="li" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>🌅 <b>2 Turnos no Fresco (04h e 16h):</b></span>
          <span class="mute">Irriga quando a evaporação é menor e dá tempo para o poço artesiano recompor a caixa de 5.000 L.</span>
        </div>
        <div class="li" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>🛡️ <b>Fila Anti-Colisão (Filtro 120 Mesh):</b></span>
          <span class="mute">Nunca abre duas zonas ao mesmo tempo, mantendo a pressão correta e protegendo o filtro de discos.</span>
        </div>
        <div class="li" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>🚨 <b>Guardião Hidráulico contra Acidentes:</b></span>
          <span class="mute">Desliga tudo se a mangueira estourar ou se a tubulação secar (falta de sucção ou bomba parada).</span>
        </div>
        <div class="li" style="padding:6px 0">
          <span>📶 <b>Autonomia sem Internet:</b></span>
          <span class="mute">Trabalha 100% sozinho na roça. Mesmo que você saia com o celular ou caia a internet, o SABIÁ continua regando.</span>
        </div>
      </div>
    </div>

    <!-- Telemetria em Tempo Real -->
    <div class="card" style="margin-top:12px;background:var(--card);border:1px solid var(--line);padding:12px 14px">
      <div class="t12 mute b" style="text-transform:uppercase;margin-bottom:8px">📊 Diagnóstico & Telemetria em Tempo Real</div>
      <div class="list t13">
        <div class="li"><span>Comunicação com o Campo:</span><b>${espOnline ? '🟢 Ativa e Operacional' : '🟠 Aguardando Sinal do SABIÁ'}</b></div>
        <div class="li"><span>Último Pacote Recebido:</span><b>${lastSeenStr}</b></div>
        <div class="li"><span>Vazão Hidráulica (Sensor SF1):</span><b>${tel && typeof tel.flow_lpm === 'number' ? tel.flow_lpm.toFixed(1) + ' L/min' : '0.0 L/min'}</b></div>
        <div class="li"><span>Nível da Caixa d'Água:</span><b>${Math.round(S.tank.level_L ?? 3750)} L (${Math.round((100 * (S.tank.level_L ?? 3750)) / S.tank.capacity)}%)</b></div>
        <div class="li"><span>Saúde do Filtro 120 Mesh:</span><b>${Math.round(S.filtro?.pct ?? 96)}%</b></div>
        <div class="li"><span>Operação no Momento:</span><b>${tel && tel.active_zone > 0 ? `Regando Zona ${tel.active_zone} (~${Math.round(tel.active_rem_L || 0)} L restantes)` : 'Repouso / Standby'}</b></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
      <button class="btn blue full" onclick="salvarConfigCloud();sincronizarEsp32();toast('☁️ Sincronização disparada com o SABIÁ!');fecharModal()">
        🔄 Sincronizar Agora
      </button>
      <button class="btn full" onclick="fecharModal()">Fechar</button>
    </div>
    <button class="btn green full sm" style="margin-top:8px" onclick="abrirModalWhatsApp('manha')">
      📲 Ver Boletim do SABIÁ para o WhatsApp
    </button>
  `);
}

/* ============================================================================
 * 9. MODAL DE NOTIFICAÇÕES & WHATSAPP DO SÍTIO
 * ========================================================================== */
function abrirModalWhatsApp(aba = 'manha', subtipoAlerta = 'tubo_seco') {
  const Notif = window.SabiaNotificacoes;
  if (!Notif) {
    toast('⚠️ Módulo de notificações carregando...');
    return;
  }

  const P = typeof planos === 'function' ? planos() : null;
  const usadoL = typeof usadoHoje === 'function' ? usadoHoje() : 0;
  const hojeStr = typeof hoje === 'function' ? hoje() : null;

  let textoMsg = '';
  if (aba === 'manha') {
    textoMsg = Notif.gerarResumoManha(S, P, hojeStr);
  } else if (aba === 'tarde') {
    textoMsg = Notif.gerarResumoTarde(S, P, hojeStr, usadoL);
  } else if (aba === 'alertas') {
    textoMsg = Notif.gerarAlertaEmergencia(subtipoAlerta, {
      siteNome: S.site?.nome,
      zona: 1,
      nivel_L: Math.round(S.tank?.level_L ?? 1150),
      pct: Math.round(100 * (S.tank?.level_L ?? 1150) / (S.tank?.capacity || 5000)),
      pctFiltro: Math.round(S.filtro?.pct ?? 65),
    });
  }

  const linkZap = Notif.gerarLinkWhatsApp(textoMsg, S.site?.whatsapp_destino || '');

  window._copiarMsgWhatsApp = function() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textoMsg).then(() => {
        toast('📋 Mensagem copiada! Abra o WhatsApp e cole no grupo.');
      }).catch(() => {
        toast('📋 Selecione e copie o texto acima.');
      });
    } else {
      toast('📋 Copie o texto do balão acima.');
    }
  };

  window._dispararMqttNotificacao = function() {
    if (window.MQTT_CLIENT && window.MQTT_CONNECTED) {
      try {
        const payload = JSON.stringify({
          tipo: aba,
          subtipo: subtipoAlerta,
          texto: textoMsg,
          site: S.site?.nome,
          ts: Date.now()
        });
        const msg = new Paho.MQTT.Message(payload);
        msg.destinationName = 'irriga-ai/ceo-hugovinicius/notify';
        msg.qos = 1;
        window.MQTT_CLIENT.send(msg);
        toast('☁️ Notificação despachada no tópico MQTT de avisos!');
      } catch (e) {
        toast('⚠️ Falha ao despachar via MQTT.');
      }
    } else {
      toast('⚠️ Conexão MQTT offline no momento.');
    }
  };

  window._salvarConfigWhatsApp = function() {
    if (!S.site) S.site = {};
    const urlInput = document.getElementById('zap-webhook-url');
    const destInput = document.getElementById('zap-dest-number');
    const autoCheck = document.getElementById('zap-auto-check');

    if (urlInput) S.site.webhook_whatsapp = urlInput.value.trim();
    if (destInput) S.site.whatsapp_destino = destInput.value.trim();
    if (autoCheck) S.site.whatsapp_auto_alerts = autoCheck.checked;

    salvarConfigCloud();
    salvarLocal();
    toast('💾 Configurações de WhatsApp salvas com sucesso!');
    abrirModalWhatsApp('webhook');
  };

  window._testarWebhookWhatsApp = async function() {
    const url = S.site?.webhook_whatsapp;
    if (!url) {
      toast('⚠️ Preencha a URL do Webhook antes de testar.');
      return;
    }
    toast('🔔 Disparando teste para o Webhook...');
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'SABIÁ Irriga.ai',
          tipo: aba,
          texto: textoMsg || '🔔 Teste de conexão do SABIÁ com o WhatsApp realizado com sucesso!',
          ts: Date.now()
        })
      });
      if (resp.ok) toast('✅ Teste entregue com sucesso ao Webhook!');
      else toast(`⚠️ Webhook respondeu com status ${resp.status}`);
    } catch (e) {
      toast('❌ Falha ao conectar ao Webhook (verifique a URL ou CORS).');
    }
  };

  abrirModal(`
    <div class="row between" style="margin-bottom:8px;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:28px">📲</span>
        <div>
          <h3 style="margin:0">WhatsApp & Avisos da Roça</h3>
          <div class="t12 mute">Boletins diários, Pro Tips e alertas para o grupo da família</div>
        </div>
      </div>
    </div>

    <!-- Navegação de Abas -->
    <div class="seg" style="margin:12px 0 14px 0">
      <button class="${aba === 'manha' ? 'sel' : ''}" onclick="abrirModalWhatsApp('manha')">☀️ Manhã (06h)</button>
      <button class="${aba === 'tarde' ? 'sel' : ''}" onclick="abrirModalWhatsApp('tarde')">🌙 Noite (18h)</button>
      <button class="${aba === 'alertas' ? 'sel' : ''}" onclick="abrirModalWhatsApp('alertas', '${subtipoAlerta}')">🚨 Alertas</button>
      <button class="${aba === 'webhook' ? 'sel' : ''}" onclick="abrirModalWhatsApp('webhook')">⚙️ Robô</button>
    </div>

    ${aba === 'alertas' ? `
      <!-- Seletor de Tipo de Alerta -->
      <div style="margin-bottom:12px">
        <label class="t12 b mute" style="display:block;margin-bottom:6px">Selecione o Alerta para Visualizar ou Testar:</label>
        <div class="seg" style="flex-wrap:wrap">
          <button class="${subtipoAlerta === 'tubo_seco' ? 'sel' : ''}" onclick="abrirModalWhatsApp('alertas', 'tubo_seco')">🚨 Tubo Seco</button>
          <button class="${subtipoAlerta === 'caixa_critica' ? 'sel' : ''}" onclick="abrirModalWhatsApp('alertas', 'caixa_critica')">🪣 Caixa Baixa</button>
          <button class="${subtipoAlerta === 'filtro_sujo' ? 'sel' : ''}" onclick="abrirModalWhatsApp('alertas', 'filtro_sujo')">🧹 Filtro 120M</button>
          <button class="${subtipoAlerta === 'sabia_offline' ? 'sel' : ''}" onclick="abrirModalWhatsApp('alertas', 'sabia_offline')">📡 Sem Sinal</button>
        </div>
      </div>
    ` : ''}

    ${aba !== 'webhook' ? `
      <!-- Visualizador no Estilo Balão do WhatsApp -->
      <div class="card" style="background:var(--sub);border:1px solid var(--line);padding:14px;border-radius:16px;margin-bottom:14px">
        <div class="row between" style="margin-bottom:8px;align-items:center">
          <span class="t12 mute b" style="text-transform:uppercase">
            ${aba === 'manha' ? '🌅 Boletim Matinal + Pro Tip' : (aba === 'tarde' ? '🌙 Balanço do Entardecer' : '🚨 Aviso de Emergência')}
          </span>
          <span class="pill green" style="font-size:11px;padding:2px 8px">Formato WhatsApp</span>
        </div>
        <div style="background:#E7FCE3;color:#0F1D15;border-radius:12px;padding:14px 16px;border:1px solid #BCEAB8;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow-y:auto;box-shadow:0 1px 3px rgba(0,0,0,0.05);font-family:inherit">
${esc(textoMsg)}
        </div>
      </div>

      <!-- Botões de Ação Imediata -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <a class="btn green full" href="${linkZap}" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:700">
          <span>📲 Abrir no WhatsApp</span>
        </a>
        <button class="btn full" onclick="window._copiarMsgWhatsApp()">
          📋 Copiar Mensagem
        </button>
      </div>

      <button class="btn sm full" style="color:var(--blue);border:1px dashed var(--line);margin-bottom:12px" onclick="window._dispararMqttNotificacao()">
        ☁️ Publicar no Tópico MQTT (Para Bots e Automações)
      </button>
    ` : `
      <!-- Aba de Configuração do Webhook / Robô -->
      <div class="card" style="background:var(--sub);border:1px solid var(--line);padding:14px;margin-bottom:14px">
        <div class="t13 b" style="margin-bottom:6px">🤖 Automação e Bot de Mensagens</div>
        <p class="t12 mute" style="margin-bottom:12px;line-height:1.5">
          Conecte um serviço de WhatsApp (CallMeBot, Evolution API, Z-API ou n8n) para que o SABIÁ envie mensagens no grupo da família automaticamente quando houver emergência ou no fechamento dos turnos.
        </p>

        <div class="field">
          <label>URL do Webhook (HTTP POST/GET)</label>
          <input id="zap-webhook-url" type="url" placeholder="https://api.callmebot.com/... ou https://seu-webhook..." value="${esc(S.site?.webhook_whatsapp || '')}" />
        </div>

        <div class="field" style="margin-top:10px">
          <label>Número do WhatsApp ou ID do Grupo (Opcional)</label>
          <input id="zap-dest-number" type="text" placeholder="Ex: 5583999998888 ou 1203630@g.us" value="${esc(S.site?.whatsapp_destino || '')}" />
        </div>

        <div class="row between" style="margin-top:14px;align-items:center;background:var(--card);padding:10px 12px;border-radius:10px;border:1px solid var(--line)">
          <div>
            <div class="t13 b">Disparar Alertas de Emergência Sozinho</div>
            <div class="t12 mute">Envia no grupo se o cano secar ou caixa atingir nível crítico</div>
          </div>
          <input id="zap-auto-check" type="checkbox" style="width:20px;height:20px" ${S.site?.whatsapp_auto_alerts !== false ? 'checked' : ''} />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          <button class="btn blue full" onclick="window._salvarConfigWhatsApp()">
            💾 Salvar Configurações
          </button>
          <button class="btn full" onclick="window._testarWebhookWhatsApp()">
            🔔 Testar Disparo
          </button>
        </div>
      </div>
    `}

    <button class="btn full" onclick="fecharModal()">Fechar</button>
  `);
}
