
This is a data store for eve online-market-browser fronted writen in go.

# Fonctionnement

Chaque ressource que fournit le store correspond à un fichier dans le package
commodities. Chaque commodity export deux fonction : un worker qui va s'occuper
de maintenir à jour les ressources et un handler pour les requettes http.
Les regions ne sont fetchés qu'une seul fois.
Les types et les market groups et les history sont fetché après chaque down
time.
Les orders c'est plus compliqué. Ils sont répartis en deux catégories, en
fonction de leur utilisation. A chaque fois qu'un order est demandé par un
utilisateur il est passé dans la catégorie prioritaire pour une semaine. Les
orders prioritaires sont updatés toutes les 10 minutes alors que les orders
non prioritaires ne sont updatés que toutes les heures.
