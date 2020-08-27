FROM nicolaka/netshoot

RUN apk add --no-cache git

COPY dataeng-tools /opt/chainalysis/dataeng-tools

RUN echo "source /opt/chainalysis/dataeng-tools/shell/init.sh" >> /root/.profile
