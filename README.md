# EVE online market browser

An in-game market clone  
Available at http://evemarketbrowser.com/


## Install

*Outdated instructions*

**Dependencies:**  
Node 20  
Go 1.22

**Configuration:**  
Set emb_dir and node_bin variables in start.sh

**Prometheus setup:**  
Run install.sh in apps/prometheus

**Systemd setup:**  
Create a /etc/emb folder  
Copy start.sh into /etc/emb/start.sh  
Symlink emb.service into /etc/systemd/system  
Enable emb service `systemctl enable emb`

**Cron jobs:**
Setup a cron jobs to restart emb.service and clear the esi-cache

**Build:**  
Build go-store binary `go build`  
Build remix app `npm run build`

**Start:**  
`systemctl start emb`


## TODO

- Improve search experience
- Test quickbar exports
- Find a way to reduce the rate of database locks
- Document this installation procedure better
- Add thera
- Add player owned private structures
- Add filters
- Add security status
- Add a flashing dot signalling whether or not orders are up to date

## Ports

node: 3000  
grafana: 3001  
prometheus: 2112  
loki: 3100  
promtial: 9080  
