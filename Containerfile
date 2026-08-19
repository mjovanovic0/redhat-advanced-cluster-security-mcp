FROM registry.access.redhat.com/ubi9/ubi AS builder
RUN dnf --disablerepo=* --enablerepo=ubi-9-baseos-rpms --enablerepo=ubi-9-appstream-rpms --enablerepo=ubi-9-codeready-builder-rpms module enable -y nodejs:20 && \
    dnf install -y --disablerepo=* --enablerepo=ubi-9-baseos-rpms --enablerepo=ubi-9-appstream-rpms --enablerepo=ubi-9-codeready-builder-rpms nodejs npm && \
    dnf clean all && \
    rm -rf /var/cache/yum /var/cache/dnf
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM registry.access.redhat.com/ubi9/ubi-minimal
RUN microdnf --disablerepo=* --enablerepo=ubi-9-baseos-rpms --enablerepo=ubi-9-appstream-rpms --enablerepo=ubi-9-codeready-builder-rpms module enable -y nodejs:20 && \
    microdnf install -y --disablerepo=* --enablerepo=ubi-9-baseos-rpms --enablerepo=ubi-9-appstream-rpms --enablerepo=ubi-9-codeready-builder-rpms nodejs npm && \
    microdnf clean all && \
    rm -rf /var/cache/yum /var/cache/dnf
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ dist/
COPY api_spec/ api_spec/
USER 1001
ENTRYPOINT ["node", "dist/index.js"]
