const { app, BrowserWindow, ipcMain } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#070d1f',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ==================== МАРКЕР ЗА КУЈНА ====================
ipcMain.handle('print-kitchen', async (event, data) => {
  try {
    const line = '================================'
    const content = `
<html>
<head>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 58mm; margin: 0; padding: 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .item { margin: 3px 0; }
  .notes { margin-left: 10px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:16px;">RESTOМК</div>
  <div class="center">${data.restaurantName || ''}</div>
  <div>${line}</div>
  <div>Маса: <b>${data.tableNumber}</b></div>
  <div>Нарачка: <b>#${data.orderNumber}</b></div>
  <div>Време: ${data.time}</div>
  <div>${line}</div>
  ${data.items.map(item => `
    <div class="item bold">${item.quantity}x ${item.name}</div>
    ${item.notes && item.notes.trim() !== '' ?
      item.notes.split(' | ').map(n => `<div class="notes">- ${n}</div>`).join('')
      : ''}
  `).join('')}
  <div>${line}</div>
</body>
</html>`

    const win = new BrowserWindow({ show: false })
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(content))
    win.webContents.print({
      silent: true,
      printBackground: true,
      pageSize: { width: 58000, height: 100000 }
    }, (success, err) => {
      win.close()
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ==================== СМЕТКА ====================
ipcMain.handle('print-receipt', async (event, data) => {
  try {
    const line = '================================'
    const content = `
<html>
<head>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 58mm; margin: 0; padding: 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .item { margin: 3px 0; display: flex; justify-content: space-between; }
  .notes { margin-left: 10px; color: #555; }
  .total { font-size: 14px; font-weight: bold; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:16px;">RESTOМК</div>
  <div class="center">${data.restaurantName || ''}</div>
  <div>${line}</div>
  <div>Маса: <b>${data.tableNumber}</b></div>
  <div>Нарачка: <b>#${data.orderNumber}</b></div>
  <div>Време: ${data.time}</div>
  <div>${line}</div>
  ${data.items.map(item => `
    <div class="item">
      <span>${item.quantity}x ${item.name}</span>
      <span>${item.total} ден</span>
    </div>
    ${item.notes && item.notes.trim() !== '' ?
      item.notes.split(' | ').map(n => `<div class="notes">- ${n}</div>`).join('')
      : ''}
  `).join('')}
  <div>${line}</div>
  <div class="item total">
    <span>ВКУПНО:</span>
    <span>${data.total} ден</span>
  </div>
  <div>Начин: ${data.payType}</div>
  <div>${line}</div>
  <div class="center">Благодариме!</div>
</body>
</html>`

    const win = new BrowserWindow({ show: false })
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(content))
    win.webContents.print({
      silent: true,
      printBackground: true,
      pageSize: { width: 58000, height: 100000 }
    }, (success, err) => {
      win.close()
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})