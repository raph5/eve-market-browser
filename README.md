# EVE online market browser

An in-game market clone  
Available at http://evemarketbrowser.com/


## Install

**Dependencies:**  
Node  
Go

**Configuration:**  
Set emb_dir and node_bin variables in start.sh

**Prometheus setup:**  
Run install.sh in apps/prometheus

**Systemd setup:**  
Create a /etc/emb folder  
Copy start.sh into /etc/emb/start.sh  
Symlink emb.service into /etc/systemd/system  
Enable emb service `systemctl enable emb`

**Build:**  
Build go-store binary `go build`  
Build remix app `npm run build`

**Start:**  
`systemctl start emb`


## To do

- Remove type from activeTypes if history == []
- Handle esi-cache renewal
- Keep view tree state on reload for quality of life
- Add responsive support
- Improve search experience
- Test quickbar exports
- Fix market group icons


## Ports

node: 3000
grafana: 3001
prometheus: 2112
loki: 3100
promtial: 9080
