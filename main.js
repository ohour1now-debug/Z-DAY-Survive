const {app,BrowserWindow}=require('electron');
app.whenReady().then(()=>{const w=new BrowserWindow({width:1280,height:800,title:'Z-DAY Survive',autoHideMenuBar:true});w.loadFile('src/index.html');});
app.on('window-all-closed',()=>app.quit());
