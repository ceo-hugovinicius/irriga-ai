# 🗺️ Irriga.ai Pro-Duo — Roadmap Técnico v1.7.0

> **Objetivo:** Guia focado para desenvolvimento com Claude na versão 1.7.0.  
> **Foco estrito:** Sincronização entre navegadores sem recarregamento (desktop/iOS PWA) e alerta de choque de cota no plantio.

---

## 📌 Task 1: Sincronização em Tempo Real Multi-Dispositivos (Celular / PC / PWA)

### O Problema:
Em versões anteriores, alterações realizadas em um dispositivo (ex: metragem de mangueira, vazão, botões de override, boost, chuva local ou lista de eventos) ficavam gravadas apenas no `localStorage` local ou eram mescladas de forma incompleta, exigindo que o agricultor desse "refresh" na página. No iOS (onde o app instalado como PWA não possui botão de recarregar nem gesto de puxar para atualizar), a tela ficava dessincronizada.

### Requisitos Obrigatórios:
1. **Sincronia Total de Estado via Nuvem (MQTT):**
   - Toda alteração em qualquer tela (hidráulica da zona, cota, solo, nível da caixa, override, pausa, reforço climático, chuva local e lista de eventos) deve ser transmitida para o tópico `irriga-ai/ceo-hugovinicius/config` de forma retida (`retained: true`).
   - Dispositivos conectados devem atualizar o DOM instantaneamente (`render()`) ao receber a mensagem, sem recarregar a página.
2. **Prevenção de Ressurreição de Dados Apagados:**
   - Valores apagados (ex: chuva local de hoje desfeita, rega manual cancelada, histórico limpo) devem substituir o estado no receptor (`S.chuvaLocal = data.chuvaLocal || {}`), e não usar mesclagem aditiva (`{ ...S.chuvaLocal, ...data.chuvaLocal }`).
3. **Comportamento PWA no iOS (Wake-up e Reconexão):**
   - Ao desbloquear o iPhone ou retornar ao app, os eventos `visibilitychange`, `pageshow` e `focus` devem reestabelecer o WebSocket MQTT e re-renderizar a tela automaticamente.
   - Disponibilizar botão de atualização manual (`🔄`) no cabeçalho para casos de oscilação de sinal no campo.

---

## 🌾 Task 2: Alerta de Choque de Cota Hídrica no Plantio

### O Problema:
Se o agricultor plantar a Zona 2 em uma data cujo pico de consumo coincida com o pico da Zona 1, a soma diária ultrapassará a cota de água da propriedade, forçando o corte de irrigação e prejudicando a colheita.

### Requisitos Obrigatórios:
1. **Detecção no Modal de Plantio:**
   - Usar a função nativa `C.sugerirDataPlantio(S, zoneIdx, cropId, dataPlantio)` de `irriga-core.js`.
   - Se o pico combinado ultrapassar a cota diária (`quota.daily_L`), alertar o agricultor informando o volume previsto.
2. **Recomendação de Data Segura:**
   - Sugerir a melhor data de plantio identificada pelo algoritmo para mitigar ou zerar o choque de cota.
   - Permitir aplicar a data recomendada com 1 toque no botão `[📅 Usar Data Recomendada]`.

---
