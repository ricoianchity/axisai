#!/bin/bash
cp public/index.html "public/index.html.bak.$(date +%Y%m%d_%H%M%S)"
echo "Backup criado."
