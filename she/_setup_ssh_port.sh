#!/bin/bash
# ============================================================
# 给 sshd 增加 2222 监听端口（保留 22，不删）
# 目的：绕过 22 端口被静默丢包的问题，恢复 AI 直连部署能力
# 特性：幂等、自动备份、语法检查失败自动回滚
# 2026-09-14  城西社团选课系统
# ============================================================
CONF=/etc/ssh/sshd_config
PORT_NEW=2222

echo "######## 0) 诊断：22 端口到底被谁挡 ########"
echo "--- iptables INPUT 前 15 条（看 pkts 计数）---"
iptables -L INPUT -n -v --line-numbers 2>/dev/null | head -18
echo
echo "--- 自定义链 YJ-FIREWALL-INPUT ---"
iptables -L YJ-FIREWALL-INPUT -n -v --line-numbers 2>/dev/null | head -12
echo
echo "--- nftables 规则（若有）---"
nft list ruleset 2>/dev/null | head -40 || echo "  （无 nft 或无规则）"
echo
echo "--- /etc/hosts.deny 是否有 sshd ---"
grep -i sshd /etc/hosts.deny 2>/dev/null || echo "  （干净）"
echo
echo "--- sshd 关键配置 ---"
grep -inE '^\s*(Port|ListenAddress|AllowUsers|AllowGroups|DenyUsers|PermitRootLogin)' $CONF 2>/dev/null || echo "  （无显式配置，用默认）"
echo
echo "--- 2222 是否已被监听 ---"
ss -tlnp 2>/dev/null | grep -E ':2222' || echo "  未监听"
echo

echo "######## 1) 备份 sshd_config ########"
BK=${CONF}.bak_$(date +%Y%m%d_%H%M%S)
cp -f $CONF $BK && echo "  已备份 -> $BK"

echo
echo "######## 2) 确保 Port 22 与 Port $PORT_NEW 都显式声明 ########"
CUR=$(grep -iE '^\s*Port\s+[0-9]+' $CONF | awk '{print $2}' | tr '\n' ' ')
echo "  当前显式 Port: ${CUR:-（无，默认 22）}"

if echo " $CUR " | grep -q ' 22 '; then
  echo "  Port 22 已在配置中"
else
  printf '\n# keep default ssh port (added %s)\nPort 22\n' "$(date +%F)" >> $CONF
  echo "  已补上 Port 22（避免显式端口将其挤掉）"
fi

if echo " $CUR " | grep -q " $PORT_NEW "; then
  echo "  Port $PORT_NEW 已存在，跳过"
else
  printf '\n# extra ssh port to bypass port-22 drop (added %s)\nPort %s\n' "$(date +%F)" "$PORT_NEW" >> $CONF
  echo "  已追加 Port $PORT_NEW"
fi
echo "  修改后:"
grep -inE '^\s*Port\s+[0-9]+' $CONF

echo
echo "######## 3) 语法检查 ########"
if sshd -t 2>/tmp/_ssh_t.err; then
  echo "  sshd_config 语法 OK"
else
  echo "  !! 语法错误："
  cat /tmp/_ssh_t.err
  echo "  自动回滚 -> $BK"
  cp -f $BK $CONF
  echo "  已回滚，未做任何改动。"
  exit 1
fi

echo
echo "######## 4) 本地防火墙放行 $PORT_NEW ########"
if systemctl is-active firewalld >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=${PORT_NEW}/tcp >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 \
    && echo "  firewalld 已放行 ${PORT_NEW}/tcp" || echo "  firewalld 放行失败（继续）"
else
  echo "  firewalld 未运行，跳过"
fi
if iptables -C INPUT -p tcp --dport $PORT_NEW -j ACCEPT 2>/dev/null; then
  echo "  iptables 已有 $PORT_NEW ACCEPT 规则"
else
  iptables -I INPUT 1 -p tcp --dport $PORT_NEW -j ACCEPT 2>/dev/null && echo "  iptables 已插入 $PORT_NEW ACCEPT"
fi
echo "  INPUT 链前 6 条:"
iptables -L INPUT -n --line-numbers 2>/dev/null | head -8

echo
echo "######## 5) SELinux ########"
SE=$(getenforce 2>/dev/null || echo Disabled)
echo "  SELinux = $SE"
if [ "$SE" = "Enforcing" ]; then
  if command -v semanage >/dev/null 2>&1; then
    semanage port -a -t ssh_port_t -p tcp $PORT_NEW 2>/dev/null \
      && echo "  已 semanage 放行 $PORT_NEW" || echo "  semanage 已存在（继续）"
  else
    echo "  !! 无 semanage 命令，若连不上需: yum install -y policycoreutils-python-utils"
  fi
fi

echo
echo "######## 6) 重启 sshd ########"
systemctl restart sshd
sleep 2
echo -n "  sshd 状态: "; systemctl is-active sshd
echo "  监听端口:"
ss -tlnp 2>/dev/null | grep -E 'sshd|:(22|2222)\b' || netstat -tlnp 2>/dev/null | grep -E 'sshd|:(22|2222)\b'

echo
echo "######## 完成 ########"
echo "本机已同时监听 22 和 $PORT_NEW。"
echo "现在从你自己电脑测一下（Windows 上开 cmd 或 PowerShell）："
echo "    ssh -p $PORT_NEW root@159.75.134.151"
echo "（腾讯云防火墙已是全端口放行，无需再改。）"
