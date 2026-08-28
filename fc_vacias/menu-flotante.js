document.addEventListener("DOMContentLoaded", function() {
  // Creamos el contenedor principal
  const container = document.createElement('div');
  container.id = 'menuFlotanteContainer';
  container.innerHTML = `
    <button id="btnMenuFlotante" onclick="toggleMenuApps()">📂 Apps</button>
    <div id="panelMenuApps">
      <div class="menu-header">
        <span>Otras Herramientas</span>
        <button onclick="toggleMenuApps()" style="background:none;border:none;color:white;font-size:14px;cursor:pointer;">✕</button>
      </div>
      <a href="../index.html">🐄 Control de Mangas (Principal)</a>
      <a href="../vacunacion/index_vacunacion.html">💉 Vacunación (Col. N)</a>
     <a href="../fc_llenas/index_fc_llenas.html">🐄 Llenas (Col. L)</a>
      <a href="../fc_vacias/index_fc_vacias.html">🐮 Vacías</a>
      <a href="../inseminacion/index_inseminacion.html">🧬 Inseminación</a>
      <a href="../traslado/traslado.html">🚛 Traslado</a>
      <a href="../brucelosis/brucelosis.html">🔬 Brucelosis</a>
      <a href="../ventas/ventas.html">💰 Ventas</a>
    </div>
  `;

  // Creamos y aplicamos los estilos para que no tengas que agregarlos en cada HTML
  const style = document.createElement('style');
  style.innerHTML = `
    #menuFlotanteContainer {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    }
    #btnMenuFlotante {
      background: #1F4E78;
      color: white;
      border: none;
      border-radius: 30px;
      padding: 12px 18px;
      font-size: 15px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #panelMenuApps {
      position: absolute;
      bottom: 55px;
      right: 0;
      background: white;
      width: 250px;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.25);
      overflow: hidden;
      border: 1px solid #ddd;
      text-align: left;
      display: none;
    }
    .menu-header {
      background: #1F4E78;
      color: white;
      padding: 10px 12px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    #panelMenuApps a {
      display: block;
      padding: 11px 14px;
      color: #333;
      text-decoration: none;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
      font-weight: bold;
    }
    #panelMenuApps a:hover, #panelMenuApps a:active {
      background: #e9ecef;
      color: #1F4E78;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(container);
});

function toggleMenuApps() {
  const panel = document.getElementById('panelMenuApps');
  if (panel) {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  }
}
